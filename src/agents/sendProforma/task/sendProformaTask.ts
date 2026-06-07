import { env } from '../../../config/env.js';
import { sendEmail } from '../../../services/nodemailer.js';
import { logger } from '../../../utils/logger.js';
import {
  findPendingSendProformasByCompanyRuc,
  markSendProformaCompleted,
  markSendProformaErrorFinal,
  markSendProformaProcessing,
  markSendProformaErrorRetryable,
} from '../data/sendProformaDao.js';
import { findSendProformaConfiguredCompanyRucValue } from '../data/sendProformaConfig.js';
import type { SendProformaModel } from '../data/sendProformaModel.js';
import { getCompanyTransporter, isFileAccessError } from '../email/sendProformaTransporter.js';
import { buildSendProformaEmailBody, resolveDocumentPath, validateDocumentAccess } from '../email/sendProformaTemplate.js';

const SEND_PROFORMA_COMPANY_RUC_SEPARATOR = ';';
const SEND_PROFORMA_PER_COMPANY_LIMIT = 10;
const AGENT_POLL_INTERVAL_MS = 240000;

async function findConfiguredCompanyRucs(): Promise<string[]> {
  try {
    const rucValue = await findSendProformaConfiguredCompanyRucValue();

    if (!rucValue) {
      return [];
    }

    return rucValue.split(SEND_PROFORMA_COMPANY_RUC_SEPARATOR);
  } catch (error) {
    logger.error({ err: error }, '[SendProformaTask] Error al obtener RUCs configurados');
    throw error;
  }
}

async function processSingleTask(task: SendProformaModel): Promise<boolean> {
  logger.info('[SendProformaTask] Iniciando envio de la proforma: ' + task.sendprfmaidentificador);

  try {
    const documentPath = resolveDocumentPath(task.sendprfmadocumento);
    const emailHtml = await buildSendProformaEmailBody(task);
    const transporter = await getCompanyTransporter(task.sendemid);

    logger.info('[SendProformaTask] Marcando proforma como en proceso');
    await markSendProformaProcessing(task.sendid);

    logger.info('[SendProformaTask] Validando acceso al documento');
    await validateDocumentAccess(documentPath);

    logger.info('[SendProformaTask] Enviando correo con la proforma adjunta');
    await sendEmail(transporter, {
      from: env.smtpFrom ?? task.sendemcorreo,
      to: [task.sendclntecorreo],
      subject: `Proforma ${task.sendprfmaidentificador}`,
      html: emailHtml,
      text: `Estimado/a ${task.sendclntenombre}, adjuntamos su proforma ${task.sendprfmaidentificador}.`,
      attachments: [
        {
          filename: `${task.sendprfmaidentificador}.pdf`,
          path: documentPath,
          contentType: 'application/pdf',
        },
      ],
    });

    logger.info('[SendProformaTask] Proforma enviada correctamente');
    await markSendProformaCompleted(task.sendid);
    logger.info('[SendProformaTask] Proforma marcada como completada');

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown send proforma error';

    if (isFileAccessError(error) && (error.code === 'ENOENT' || error.code === 'EACCES')) {
      logger.error(
        {
          err: error,
          documentPath: task.sendprfmadocumento,
          sendemid: task.sendemid,
          sendemruc: task.sendemruc,
          sendid: task.sendid,
        },
        '[SendProformaTask] Error de acceso al documento de la proforma',
      );
      await markSendProformaErrorFinal(
        task.sendid,
        `[SendProformaTask] Error de acceso al documento para la proforma ${task.sendprfmaidentificador}: ${errorMessage}`,
      );
      return false;
    }

    logger.error(
      { err: error, sendemid: task.sendemid, sendemruc: task.sendemruc, sendid: task.sendid },
      '[SendProformaTask] Error al procesar tarea de envío de proforma',
    );
    await markSendProformaErrorRetryable(task.sendid, errorMessage);
    return false;
  }
}

async function processCompanySendBatch(ruc: string): Promise<number> {
  const pendingTasks = await findPendingSendProformasByCompanyRuc(ruc, SEND_PROFORMA_PER_COMPANY_LIMIT);

  if (pendingTasks.length === 0) {
    return 0;
  }

  logger.info(
    { ruc, tasks: pendingTasks.length },
    '[SendProformaTask] Tareas pendientes encontradas para empresa',
  );

  let completedTasks = 0;

  for (const task of pendingTasks) {
    try {
      const completed = await processSingleTask(task);

      if (completed) {
        completedTasks += 1;
        logger.info({ sendid: task.sendid }, '[SendProformaTask] Tarea de envío completada');
      } else {
        logger.warn({ sendid: task.sendid }, '[SendProformaTask] Tarea de envío no completada');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown send proforma error';
      await markSendProformaErrorRetryable(task.sendid, errorMessage);
      logger.error({ sendid: task.sendid, err: error }, '[SendProformaTask] Error al procesar tarea');
    }
  }

  return completedTasks;
}

async function runSendProformaIteration(): Promise<void> {
  try {
    const companyRucs = await findConfiguredCompanyRucs();

    if (companyRucs.length === 0) {
      logger.info('[SendProformaTask] No hay RUCs configurados para el agente');
      return;
    }

    logger.info('[SendProformaTask] RUCs configurados: ' + companyRucs.length);
    let totalSent = 0;

    for (const ruc of companyRucs) {
      if (!ruc) {
        continue;
      }

      logger.info('[SendProformaTask] Procesando empresa con RUC: ' + ruc);

      try {
        const sent = await processCompanySendBatch(ruc);
        totalSent += sent;
        logger.info({ ruc, sent }, '[SendProformaTask] Empresa procesada');
      } catch (error) {
        logger.error({ err: error, ruc }, '[SendProformaTask] Error al procesar empresa');
      }
    }

    if (totalSent > 0) {
      logger.info({ totalSent }, '[SendProformaTask] Proformas enviadas en esta iteración');
    } else {
      logger.info('[SendProformaTask] No hay proformas pendientes');
    }
  } catch (error) {
    logger.error({ err: error }, '[SendProformaTask] Error en la iteración del agente');
  }
}

async function startSendProformaAgent(): Promise<void> {
  let isRunning = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const handleSignal = (signal: NodeJS.Signals): void => {
    logger.info('[SendProformaTask] Señal recibida: ' + signal);
    isRunning = false;

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  logger.info('[SendProformaTask] Agente de envío de proformas iniciado');

  try {
    await runSendProformaIteration();

    intervalId = setInterval(async () => {
      if (!isRunning) {
        return;
      }

      try {
        await runSendProformaIteration();
      } catch (error) {
        logger.error({ err: error }, 'Error en el ciclo del agente');
      }
    }, AGENT_POLL_INTERVAL_MS);

    await new Promise<void>((resolvePromise) => {
      const waitForStop = setInterval(() => {
        if (!isRunning) {
          clearInterval(waitForStop);
          resolvePromise();
        }
      }, 250);
    });
  } finally {
    if (intervalId) {
      clearInterval(intervalId);
    }

    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    logger.info('[SendProformaTask] Agente de envío de proformas detenido');
  }
}

export { startSendProformaAgent };

startSendProformaAgent().catch((error) => {
  logger.error({ err: error }, 'Send proforma agent failed');
  process.exit(1);
});
