import { logger } from '../../../utils/logger.js';
import {
  findCompanyIdByRuc,
  findLowStockProductsByCompany,
  hideObsoleteAlerts,
  upsertAlert,
} from '../data/stockAlertDao.js';
import { findStockAlertConfiguredCompanyRucValue } from '../data/stockAlertConfig.js';

const STOCK_ALERT_COMPANY_RUC_SEPARATOR = ';';
const AGENT_POLL_INTERVAL_MS = 300000;

async function findConfiguredCompanyRucs(): Promise<string[]> {
  try {
    const rucValue = await findStockAlertConfiguredCompanyRucValue();

    if (!rucValue) {
      return [];
    }

    return rucValue.split(STOCK_ALERT_COMPANY_RUC_SEPARATOR);
  } catch (error) {
    logger.error({ err: error }, '[StockAlertTask] Error al obtener RUCs configurados');
    throw error;
  }
}

async function processCompanyAlertBatch(emid: string): Promise<number> {
  const lowStockProducts = await findLowStockProductsByCompany(emid);

  if (lowStockProducts.length === 0) {
    return 0;
  }

  logger.info(
    { emid, products: lowStockProducts.length },
    '[StockAlertTask] Productos con stock bajo encontrados',
  );

  let createdAlerts = 0;

  for (const product of lowStockProducts) {
    try {
      const mensaje = `Stock bajo en ${product.sucursalnombre}: ${product.prdtonombre} (${product.prdtocodigo}) - Actual: ${product.stckcantidad}, Mínimo: ${product.prdtostockminimo}`;

      await upsertAlert({
        alemid: product.stckemid,
        alsuid: product.stcksuid,
        alprdtoid: product.stckprdtoid,
        altipo: 'stock_bajo',
        almensaje: mensaje,
        alcantidadactual: product.stckcantidad,
        alstockminimo: product.prdtostockminimo,
        alstockmaximo: product.prdtostockmaximo,
      });

      createdAlerts += 1;
      logger.info(
        { productId: product.stckprdtoid, branchId: product.stcksuid },
        '[StockAlertTask] Alerta de stock bajo creada/actualizada',
      );
    } catch (error) {
      logger.error(
        { err: error, productId: product.stckprdtoid, emid },
        '[StockAlertTask] Error al crear alerta de stock bajo',
      );
    }
  }

  return createdAlerts;
}

async function runStockAlertIteration(): Promise<void> {
  try {
    const companyRucs = await findConfiguredCompanyRucs();

    if (companyRucs.length === 0) {
      logger.info('[StockAlertTask] No hay RUCs configurados para el agente');
      return;
    }

    logger.info('[StockAlertTask] RUCs configurados encontrados: ' + companyRucs.length);
    let totalAlerts = 0;

    for (const ruc of companyRucs) {
      if (!ruc) {
        continue;
      }

      logger.info('[StockAlertTask] Procesando empresa con RUC: ' + ruc);

      try {
        const emid = await findCompanyIdByRuc(ruc);

        if (!emid) {
          logger.warn('[StockAlertTask] No se encontró empresa con RUC: ' + ruc);
          continue;
        }

        const hiddenCount = await hideObsoleteAlerts(emid);

        if (hiddenCount > 0) {
          logger.info(
            { emid, hiddenCount },
            '[StockAlertTask] Alertas obsoletas ocultadas',
          );
        }

        const alertsCreated = await processCompanyAlertBatch(emid);
        totalAlerts += alertsCreated;
        logger.info(
          { emid, alertsCreated },
          '[StockAlertTask] Empresa procesada',
        );
      } catch (error) {
        logger.error({ err: error, ruc }, '[StockAlertTask] Error al procesar empresa');
      }
    }

    if (totalAlerts > 0) {
      logger.info({ totalAlerts }, '[StockAlertTask] Alertas creadas/actualizadas en esta iteración');
    } else {
      logger.info('[StockAlertTask] No se encontraron productos con stock bajo');
    }
  } catch (error) {
    logger.error({ err: error }, '[StockAlertTask] Error en la iteración del agente');
  }
}

async function startStockAlertAgent(): Promise<void> {
  let isRunning = true;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const handleSignal = (signal: NodeJS.Signals): void => {
    logger.info('[StockAlertTask] Señal recibida: ' + signal);
    isRunning = false;

    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  logger.info('[StockAlertTask] Agente de alertas de stock iniciado');

  const scheduleNext = (): void => {
    if (!isRunning) {
      return;
    }

    timerId = setTimeout(async () => {
      try {
        logger.info('[StockAlertTask] Ejecutando iteración programada');
        await runStockAlertIteration();
      } catch (error) {
        logger.error({ err: error }, 'Error en el ciclo del agente');
      }
      scheduleNext();
    }, AGENT_POLL_INTERVAL_MS);
  };

  try {
    logger.info('[StockAlertTask] Ejecutando iteración inicial');
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
    logger.info('[StockAlertTask] Agente de alertas de stock detenido');
  }
}

export { startStockAlertAgent };

startStockAlertAgent().catch((error) => {
  logger.error({ err: error }, 'Stock alert agent failed');
  process.exit(1);
});
