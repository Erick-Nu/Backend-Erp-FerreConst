import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';

type ConfigRow = {
  cfclave: string;
  cfvalor: string;
};

const FIND_SEND_PROFORMA_CONFIGURED_COMPANY_RUC_QUERY = `
  select cfvalor
  from configuracion
  where cfclave = 'sendproforma.email.empresa'
  limit 1
`;

async function findSendProformaConfiguredCompanyRucValue(): Promise<string | undefined> {
  try {
    const rows = await sql.unsafe<ConfigRow[]>(FIND_SEND_PROFORMA_CONFIGURED_COMPANY_RUC_QUERY);
    const row = rows[0];
    return row?.cfvalor;
  } catch (error) {
    logger.error({ err: error }, 'Error finding send proforma configured companies');
    throw new Error('Error finding send proforma configured companies');
  }
}

const FIND_SEND_PROFORMA_COMPANY_CONFIG_ROWS_QUERY = `
  select cfclave, cfvalor
  from configuracion
  where cfemid = $1 and cfclave like 'sendproforma%'
`;

async function findSendProformaCompanyConfigRows(sendemid: string): Promise<ConfigRow[]> {
  try {
    return await sql.unsafe<ConfigRow[]>(FIND_SEND_PROFORMA_COMPANY_CONFIG_ROWS_QUERY, [sendemid]);
  } catch (error) {
    logger.error({ err: error, sendemid }, 'Error finding send proforma company config');
    throw new Error('Error finding send proforma company config');
  }
}

export { findSendProformaConfiguredCompanyRucValue, findSendProformaCompanyConfigRows };
