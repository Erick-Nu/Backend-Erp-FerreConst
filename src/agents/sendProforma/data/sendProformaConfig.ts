import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';

type ConfigRow = {
  cfclave: string;
  cfvalor: string;
};

// NOTE: todas las configuraciones de este agente en la tabla `configuracion` deben iniciar con el prefijo `sendproforma.`.

const FIND_SEND_PROFORMA_COMPANY_CONFIG_ROWS_QUERY = `
  select cfclave, cfvalor
  from configuracion
  where cfemid = $1 and cfclave like 'sendproforma%'
`;

const FIND_SEND_PROFORMA_CONFIGURED_COMPANY_RUC_QUERY = `
  select cfvalor
  from configuracion
  where cfclave = 'sendproforma.email.empresa'
  limit 1
`;

function buildConfigObject(rows: ConfigRow[]): Record<string, string> {
  const configObject: Record<string, string> = {};

  for (const row of rows) {
    configObject[row.cfclave] = row.cfvalor;
  }

  return configObject;
}

async function findSendProformaCompanyConfig(sendemid: string): Promise<Record<string, string>> {
  try {
    const rows = await sql.unsafe<ConfigRow[]>(FIND_SEND_PROFORMA_COMPANY_CONFIG_ROWS_QUERY, [
      sendemid,
    ]);
    return buildConfigObject(rows);
  } catch (error) {
    logger.error({ err: error, sendemid }, 'Error finding send proforma company config');
    throw new Error('Error finding send proforma company config');
  }
}

async function findSendProformaConfiguredCompanyRucValue(): Promise<string | undefined> {
  try {
    const rows = await sql.unsafe<ConfigRow[]>(FIND_SEND_PROFORMA_CONFIGURED_COMPANY_RUC_QUERY);
    if (rows.length === 0) {
      return undefined;
    }
    return rows[0]?.cfvalor;
  } catch (error) {
    logger.error({ err: error }, 'Error finding send proforma configured companies');
    throw new Error('Error finding send proforma configured companies');
  }
}

export { findSendProformaCompanyConfig, findSendProformaConfiguredCompanyRucValue };
