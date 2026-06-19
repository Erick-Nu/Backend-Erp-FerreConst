import { logger } from '../../../utils/logger.js';
import {
  findCompanyIdByRuc,
  findLowStockProductsByCompany,
  hideObsoleteAlerts,
  upsertAlert,
} from '../data/stockAlertDao.js';
import {
  findStockAlertCompanyAlertConfig,
  findStockAlertConfiguredCompanyRucValue,
} from '../data/stockAlertConfig.js';

const STOCK_ALERT_COMPANY_RUC_SEPARATOR = ';';
const AGENT_POLL_INTERVAL_MS = 300000;
const STOCK_ALERT_LOG_PREFIX = '[stockAlertTask]';

async function findConfiguredCompanyRucs(): Promise<string[]> {
  try {
    const rucValue = await findStockAlertConfiguredCompanyRucValue();

    if (!rucValue) {
      return [];
    }

    return [
      ...new Set(
        rucValue
          .split(STOCK_ALERT_COMPANY_RUC_SEPARATOR)
          .map((ruc) => ruc.trim())
          .filter((ruc) => ruc.length > 0),
      ),
    ];
  } catch (error) {
    logger.error({ err: error }, `${STOCK_ALERT_LOG_PREFIX} Error al obtener RUCs configurados`);
    throw error;
  }
}

async function processCompanyAlertBatch(emid: string, reminderMinutes: number): Promise<number> {
  const lowStockProducts = await findLowStockProductsByCompany(emid);

  if (lowStockProducts.length === 0) {
    return 0;
  }

  logger.info(
    { emid, products: lowStockProducts.length },
    `${STOCK_ALERT_LOG_PREFIX} Productos con stock bajo encontrados`,
  );

  let changedAlerts = 0;

  for (const product of lowStockProducts) {
    try {
      const mensaje = `Stock bajo en ${product.sucursalnombre}: ${product.prdtonombre} (${product.prdtocodigo}) - Actual: ${product.stckcantidad}, Mínimo: ${product.prdtostockminimo}`;

      const alertResult = await upsertAlert({
        alemid: product.stckemid,
        alsuid: product.stcksuid,
        alprdtoid: product.stckprdtoid,
        altipo: 'stock_bajo',
        almensaje: mensaje,
        alcantidadactual: product.stckcantidad,
        alstockminimo: product.prdtostockminimo,
        alstockmaximo: product.prdtostockmaximo,
      }, reminderMinutes);

      if (alertResult.status !== 'unchanged') {
        changedAlerts += 1;
      }

      logger.info(
        {
          alertId: alertResult.alid,
          status: alertResult.status,
          productId: product.stckprdtoid,
          branchId: product.stcksuid,
        },
        `${STOCK_ALERT_LOG_PREFIX} Alerta de stock bajo procesada`,
      );
    } catch (error) {
      logger.error(
        { err: error, productId: product.stckprdtoid, emid },
        `${STOCK_ALERT_LOG_PREFIX} Error al crear alerta de stock bajo`,
      );
    }
  }

  return changedAlerts;
}

async function runStockAlertIteration(): Promise<void> {
  try {
    const companyRucs = await findConfiguredCompanyRucs();

    if (companyRucs.length === 0) {
      logger.info(`${STOCK_ALERT_LOG_PREFIX} No hay RUCs configurados para el agente`);
      return;
    }

    logger.info(`${STOCK_ALERT_LOG_PREFIX} RUCs configurados encontrados: ${companyRucs.length}`);
    let totalAlerts = 0;

    for (const ruc of companyRucs) {
      if (!ruc) {
        continue;
      }

      logger.info(`${STOCK_ALERT_LOG_PREFIX} Procesando empresa con RUC: ${ruc}`);

      try {
        const emid = await findCompanyIdByRuc(ruc);

        if (!emid) {
          logger.warn(`${STOCK_ALERT_LOG_PREFIX} No se encontró empresa con RUC: ${ruc}`);
          continue;
        }

        const companyConfig = await findStockAlertCompanyAlertConfig(emid);
        if (!companyConfig.active) {
          logger.info(
            { emid, ruc },
            `${STOCK_ALERT_LOG_PREFIX} Empresa omitida porque stockalert.alerta.active no está habilitado`,
          );
          continue;
        }

        const hiddenAlerts = await hideObsoleteAlerts(emid);
        totalAlerts += hiddenAlerts.length;

        if (hiddenAlerts.length > 0) {
          logger.info(
            { emid, hiddenCount: hiddenAlerts.length },
            `${STOCK_ALERT_LOG_PREFIX} Alertas obsoletas ocultadas`,
          );
        }

        const alertsChanged = await processCompanyAlertBatch(emid, companyConfig.reminderMinutes);
        totalAlerts += alertsChanged;
        logger.info(
          { emid, alertsChanged, reminderMinutes: companyConfig.reminderMinutes },
          `${STOCK_ALERT_LOG_PREFIX} Empresa procesada`,
        );
      } catch (error) {
        logger.error({ err: error, ruc }, `${STOCK_ALERT_LOG_PREFIX} Error al procesar empresa`);
      }
    }

    if (totalAlerts > 0) {
      logger.info({ totalAlerts }, `${STOCK_ALERT_LOG_PREFIX} Alertas cambiadas en esta iteración`);
    } else {
      logger.info(`${STOCK_ALERT_LOG_PREFIX} No hubo cambios de alertas en esta iteración`);
    }
  } catch (error) {
    logger.error({ err: error }, `${STOCK_ALERT_LOG_PREFIX} Error en la iteración del agente`);
  }
}

async function startStockAlertAgent(): Promise<void> {
  let isRunning = true;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const handleSignal = (signal: NodeJS.Signals): void => {
    logger.info(`${STOCK_ALERT_LOG_PREFIX} Señal recibida: ${signal}`);
    isRunning = false;

    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  logger.info(`${STOCK_ALERT_LOG_PREFIX} Agente de alertas de stock iniciado`);

  const scheduleNext = (): void => {
    if (!isRunning) {
      return;
    }

    timerId = setTimeout(async () => {
      try {
        logger.info(`${STOCK_ALERT_LOG_PREFIX} Ejecutando iteración programada`);
        await runStockAlertIteration();
      } catch (error) {
        logger.error({ err: error }, `${STOCK_ALERT_LOG_PREFIX} Error en el ciclo del agente`);
      }
      scheduleNext();
    }, AGENT_POLL_INTERVAL_MS);
  };

  try {
    logger.info(`${STOCK_ALERT_LOG_PREFIX} Ejecutando iteración inicial`);
    await runStockAlertIteration();
    scheduleNext();

    await new Promise<void>((resolvePromise) => {
      const waitForStop = setInterval(() => {
        if (!isRunning) {
          clearInterval(waitForStop);
          resolvePromise();
        }
      }, 250);
    });
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }

    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    logger.info(`${STOCK_ALERT_LOG_PREFIX} Agente de alertas de stock detenido`);
  }
}

export { startStockAlertAgent };

startStockAlertAgent().catch((error) => {
  logger.error({ err: error }, `${STOCK_ALERT_LOG_PREFIX} Stock alert agent failed`);
  process.exit(1);
});
