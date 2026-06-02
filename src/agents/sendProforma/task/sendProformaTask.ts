import { access, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import type { Transporter } from 'nodemailer';
import { env } from '../../../config/env.js';
import { createTransporter, sendEmail } from '../../../services/nodemailer.js';
import { logger } from '../../../utils/logger.js';
import {
  findPendingSendProformasByCompanyRuc,
  markSendProformaCompleted,
  markSendProformaErrorFinal,
  markSendProformaErrorRetryable,
  markSendProformaProcessing,
} from '../data/sendProformaDao.js';
import type { SendProformaModel } from '../data/sendProformaModel.js';
import {
  findSendProformaCompanyConfig,
  findSendProformaConfiguredCompanyRucValue,
} from '../data/sendProformaConfig.js';

const SEND_PROFORMA_EMAIL_USER_KEY = 'sendproforma.email.user';
const SEND_PROFORMA_EMAIL_PASSWORD_KEY = 'sendproforma.email.password';
const SEND_PROFORMA_COMPANY_RUC_SEPARATOR = ';';
const SEND_PROFORMA_EMAIL_TEMPLATE_PATH = 'uploads/templates/send-proforma-email.html';
const SEND_PROFORMA_PER_COMPANY_LIMIT = 10;
const SEND_PROFORMA_TOTAL_BATCH_LIMIT = 50;
const AGENT_POLL_INTERVAL_MS = 10000;
const transporterByCompanyId: Record<string, Transporter> = {};
let sendProformaEmailTemplate: string | null = null;

type CompanyEmailCredentials = {
  emailPassword: string;
  emailUser: string;
};

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

async function loadPendingBatch(companyRucs: string[]): Promise<SendProformaModel[]> {
  logger.info('[SendProformaTask] Cargando tareas pendientes de envío de proformas');
  const batch: SendProformaModel[] = [];

  for (const companyRuc of companyRucs) {
    if (!companyRuc) {
      continue;
    }

    logger.info('[SendProformaTask] Cargando tareas pendientes para empresa con RUC: ' + companyRuc);
    const companyTasks = await findPendingSendProformasByCompanyRuc(companyRuc, SEND_PROFORMA_PER_COMPANY_LIMIT);

    for (const task of companyTasks) {
      batch.push(task);

      if (batch.length >= SEND_PROFORMA_TOTAL_BATCH_LIMIT) {
        return batch;
      }
    }
  }

  return batch;
}

function createAgentTransporter(emailUser: string, emailPassword: string): Transporter {
  const smtpHost = env.smtpHost ?? '';
  const smtpPort = env.smtpPort ?? 0;
  const smtpSecure = env.smtpSecure ?? false;

  if (!smtpHost || !smtpPort || !emailUser || !emailPassword) {
    throw new Error('Missing SMTP configuration for send proforma');
  }

  return createTransporter({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: emailUser,
    pass: emailPassword,
  });
}

async function findCompanyEmailCredentials(sendemid: string): Promise<CompanyEmailCredentials> {
  logger.info('[SendProformaTask] Obteniendo credenciales de correo para empresa');
  const companyConfig = await findSendProformaCompanyConfig(sendemid);
  logger.info('[SendProformaTask] Configuración de empresa obtenida');
  const emailUser = companyConfig[SEND_PROFORMA_EMAIL_USER_KEY];
  const emailPassword = companyConfig[SEND_PROFORMA_EMAIL_PASSWORD_KEY];

  if (!emailUser || !emailPassword) {
    logger.error('[SendProformaTask] Configuración de correo incompleta para empresa: ' + sendemid);
    throw new Error(`Missing company email configuration for send proforma: ${sendemid}`);
  }

  return { emailPassword, emailUser };
}

async function getCompanyTransporter(sendemid: string): Promise<Transporter> {
  logger.info('[SendProformaTask] Obteniendo transporter para empresa');
  const cachedTransporter = transporterByCompanyId[sendemid];

  if (cachedTransporter) {
    logger.info('[SendProformaTask] Transporter encontrado en caché para empresa');
    return cachedTransporter;
  }

  logger.info('[SendProformaTask] Transporter no encontrado en caché, creando uno nuevo');
  const { emailUser, emailPassword } = await findCompanyEmailCredentials(sendemid);
  const transporter = createAgentTransporter(emailUser, emailPassword);

  transporterByCompanyId[sendemid] = transporter;

  logger.info('[SendProformaTask] Transporter creado y almacenado en caché');
  return transporter;
}

async function validateDocumentAccess(documentPath: string): Promise<void> {
  await access(documentPath);
}

function resolveDocumentPath(documentPath: string): string {
  if (documentPath.startsWith('/uploads/')) {
    return resolve(process.cwd(), documentPath.replace(/^\/+/, ''));
  }

  if (isAbsolute(documentPath)) {
    return documentPath;
  }

  return resolve(process.cwd(), documentPath);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrencyAmount(value: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function getSendProformaEmailTemplate(): Promise<string> {
  if (sendProformaEmailTemplate) {
    logger.info('[SendProformaTask] Plantilla de correo encontrada en caché');
    return sendProformaEmailTemplate;
  }

  const templatePath = resolve(process.cwd(), SEND_PROFORMA_EMAIL_TEMPLATE_PATH);
  logger.info('[SendProformaTask] Cargando plantilla de correo para envío de proforma');
  const templateContent = await readFile(templatePath, 'utf-8');
  sendProformaEmailTemplate = templateContent;
  logger.info('[SendProformaTask] Plantilla de correo cargada correctamente');
  return templateContent;
}

async function buildSendProformaEmailBody(task: SendProformaModel): Promise<string> {
  const template = await getSendProformaEmailTemplate();

  logger.info('[SendProformaTask] Renderizando plantilla de correo para la proforma: ' + task.sendprfmaidentificador);
  return template
    .replaceAll('{{receptor}}', escapeHtml(task.sendclntenombre))
    .replaceAll('{{proforma}}', escapeHtml(task.sendprfmaidentificador))
    .replaceAll('{{empresa}}', escapeHtml(task.sendemrznsocial))
    .replaceAll('{{sucursal}}', escapeHtml(task.sendsuidentificador))
    .replaceAll('{{pago}}', escapeHtml(task.sendmpnombre))
    .replaceAll('{{total}}', escapeHtml(formatCurrencyAmount(task.sendprfmatotal)))
    .replaceAll('{{emisor}}', escapeHtml(task.sendemrznsocial))
    .replaceAll('{{emisorMail}}', escapeHtml(task.sendemcorreo));
}

async function processSingleTask(task: SendProformaModel, transporter: Transporter): Promise<boolean> {
  logger.info('[SendProformaTask] Iniciando envio de la proforma: ' + task.sendprfmaidentificador);
  try {
    const documentPath = resolveDocumentPath(task.sendprfmadocumento);
    const emailHtml = await buildSendProformaEmailBody(task);
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

    if (errorMessage.includes('ENOENT') || errorMessage.includes('EACCES')) {
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

async function processSendProformaBatch(companyRucs: string[]): Promise<number> {
  logger.info('[SendProformaTask] Procesando lote de envío de proformas');

  if (companyRucs.length === 0) {
    logger.info('[SendProformaTask] No hay RUCs configurados para el agente, esperando para reintentar');
    return 0;
  }

  const pendingTasks = await loadPendingBatch(companyRucs);

  if (pendingTasks.length === 0) {
    logger.info('[SendProformaTask] No hay tareas pendientes de envío de proformas');
    return 0;
  }

  logger.info({ tasks: pendingTasks.length }, '[SendProformaTask] Tareas pendientes encontradas');
  let completedTasks = 0;

  for (const task of pendingTasks) {
    try {
      logger.info('[SendProformaTask] Procesando tarea de envío de proforma para la empresa: ' + task.sendemruc);
      const transporter = await getCompanyTransporter(task.sendemid);
      const completed = await processSingleTask(task, transporter);

      if (completed) {
        completedTasks += 1;
        logger.info({ sendid: task.sendid }, '[SendProformaTask] Tarea de envío de proforma completada');
      } else {
        logger.warn(
          { sendid: task.sendid, sendemruc: task.sendemruc },
          '[SendProformaTask] Tarea de envío de proforma no completada',
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown send proforma error';
      await markSendProformaErrorRetryable(task.sendid, errorMessage);
      logger.error({ sendid: task.sendid, err: error }, '[SendProformaTask] Error al procesar tarea de envío de proforma');
    }
  }

  logger.info(
    { completed: completedTasks, total: pendingTasks.length },
    '[SendProformaTask] Lote de envío de proformas procesado',
  );
  return completedTasks;
}

async function runSendProformaIteration(): Promise<void> {
  try {
    logger.info('[SendProformaTask] Buscando RUCs configurados');
    const companyRucs = await findConfiguredCompanyRucs();

    if (companyRucs.length === 0) {
      logger.info('[SendProformaTask] No hay RUCs configurados para el agente, esperando para reintentar');
      return;
    }

    logger.info(`[SendProformaTask] RUCs configurados encontrados: ${companyRucs.length}`);

    const processedCount = await processSendProformaBatch(companyRucs);
    if (!processedCount) {
      logger.info('[SendProformaTask] No se procesaron tareas en esta iteración, esperando para reintentar');
    }
  } catch (error) {
    logger.error({ err: error }, '[SendProformaTask] Error en la iteración del agente');
  }
}

async function startSendProformaAgent(): Promise<void> {
  let isRunning = true;
  let intervalId: NodeJS.Timeout | null = null;

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

  logger.info('Agente asíncrono iniciado');

  try {
    logger.info('[SendProformaTask] Ejecutando iteración inicial del agente');
    await runSendProformaIteration();

    intervalId = setInterval(async () => {
      if (!isRunning) {
        return;
      }

      try {
        logger.info('[SendProformaTask] Ejecutando iteración programada del agente');
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

export { processSendProformaBatch, startSendProformaAgent };

startSendProformaAgent().catch((error) => {
  logger.error({ err: error }, 'Send proforma agent failed');
  process.exit(1);
});
