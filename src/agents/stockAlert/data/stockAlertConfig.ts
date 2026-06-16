import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';

const STOCK_ALERT_LOG_PREFIX = '[stockAlertTask]';

type ConfigRow = {
  cfclave: string;
  cfvalor: string;
};

const FIND_STOCK_ALERT_CONFIGURED_COMPANY_RUC_QUERY = `
  select cfvalor
  from configuracion
  where cfclave = 'stockalert.empresa'
  limit 1
`;

async function findStockAlertConfiguredCompanyRucValue(): Promise<string | undefined> {
  try {
    const rows = await sql.unsafe<ConfigRow[]>(FIND_STOCK_ALERT_CONFIGURED_COMPANY_RUC_QUERY);
    const row = rows[0];
    return row?.cfvalor;
  } catch (error) {
    logger.error({ err: error }, `${STOCK_ALERT_LOG_PREFIX} Error finding stock alert configured companies`);
    throw new Error('Error finding stock alert configured companies');
  }
}

export { findStockAlertConfiguredCompanyRucValue };
