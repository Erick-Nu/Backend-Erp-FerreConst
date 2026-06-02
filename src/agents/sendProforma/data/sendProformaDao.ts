import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';
import type { SendProformaModel } from './sendProformaModel.js';

const FIND_PENDING_SEND_PROFORMAS_BY_COMPANY_RUC_QUERY = `
  select * from sendproforma
  where sendestado = 'pendiente' and sendemruc = $1
  order by sendfchcreacion asc
  limit $2
`;

async function findPendingSendProformasByCompanyRuc(sendemruc: string, limit: number): Promise<SendProformaModel[]> {
  try {
    return await sql.unsafe<SendProformaModel[]>(FIND_PENDING_SEND_PROFORMAS_BY_COMPANY_RUC_QUERY, [
      sendemruc,
      limit,
    ]);
  } catch (error) {
    logger.error({ err: error, sendemruc, limit }, 'Error finding pending send proforma tasks by company ruc');
    throw new Error('Error finding pending send proforma tasks by company ruc');
  }
}

const MARK_SEND_PROFORMA_PROCESSING_QUERY = `
  update sendproforma
  set sendestado = 'procesando',
      sendfchactualizacion = current_timestamp
  where sendid = $1
`;

async function markSendProformaProcessing(sendid: string): Promise<void> {
  try {
    await sql.unsafe(MARK_SEND_PROFORMA_PROCESSING_QUERY, [sendid]);
  } catch (error) {
    logger.error({ err: error, sendid }, 'Error marking send proforma task as processing');
    throw new Error('Error marking send proforma task as processing');
  }
}

const MARK_SEND_PROFORMA_COMPLETED_QUERY = `
  update sendproforma
  set sendestado = 'completado',
      senderror = null,
      sendfchactualizacion = current_timestamp
  where sendid = $1
`;

async function markSendProformaCompleted(sendid: string): Promise<void> {
  try {
    await sql.unsafe(MARK_SEND_PROFORMA_COMPLETED_QUERY, [sendid]);
  } catch (error) {
    logger.error({ err: error, sendid }, 'Error marking send proforma task as completed');
    throw new Error('Error marking send proforma task as completed');
  }
}

const MARK_SEND_PROFORMA_ERROR_RETRYABLE_QUERY = `
  update sendproforma
  set sendestado = case
        when sendintentos + 1 >= 3 then 'fallido'
        else 'pendiente'
      end,
      senderror = $2,
      sendintentos = sendintentos + 1,
      sendfchactualizacion = current_timestamp
  where sendid = $1
`;

async function markSendProformaErrorRetryable(sendid: string, errorMessage: string): Promise<void> {
  try {
    await sql.unsafe(MARK_SEND_PROFORMA_ERROR_RETRYABLE_QUERY, [sendid, errorMessage]);
  } catch (error) {
    logger.error({ err: error, sendid }, 'Error marking send proforma task as retryable error');
    throw new Error('Error marking send proforma task as retryable error');
  }
}

const MARK_SEND_PROFORMA_ERROR_FINAL_QUERY = `
  update sendproforma
  set sendestado = 'fallido',
      senderror = $2,
      sendintentos = sendintentos + 1,
      sendfchactualizacion = current_timestamp
  where sendid = $1
`;

async function markSendProformaErrorFinal(sendid: string, errorMessage: string): Promise<void> {
  try {
    await sql.unsafe(MARK_SEND_PROFORMA_ERROR_FINAL_QUERY, [sendid, errorMessage]);
  } catch (error) {
    logger.error({ err: error, sendid }, 'Error marking send proforma task as final error');
    throw new Error('Error marking send proforma task as final error');
  }
}

export {
  findPendingSendProformasByCompanyRuc,
  markSendProformaProcessing,
  markSendProformaCompleted,
  markSendProformaErrorRetryable,
  markSendProformaErrorFinal,
};
