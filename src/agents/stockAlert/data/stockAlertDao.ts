import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';
import type { CompanyRucResult, LowStockProductResult, UpsertAlertData } from './stockAlertModel.js';

const STOCK_ALERT_LOG_PREFIX = '[stockAlertTask]';

const FIND_LOW_STOCK_PRODUCTS_QUERY = `
  select
    s.stckemid,
    s.stcksuid,
    s.stckprdtoid,
    s.stckcantidad,
    p.prdtostockminimo,
    p.prdtostockmaximo,
    p.prdtonombre,
    p.prdtocodigo,
    br.sunombre as sucursalnombre
  from stock s
  join producto p
    on p.prdtoid = s.stckprdtoid
    and p.prdtoemid = s.stckemid
  join sucursal br
    on br.suid = s.stcksuid
    and br.suemid = s.stckemid
  where s.stckemid = $1
    and s.stckcantidad <= p.prdtostockminimo
    and s.stckestado = 'activo'
    and p.prdtoestado = 'activo'
    and br.suestado = 'activo'
`;

async function findLowStockProductsByCompany(emid: string): Promise<LowStockProductResult[]> {
  try {
    return await sql.unsafe<LowStockProductResult[]>(FIND_LOW_STOCK_PRODUCTS_QUERY, [emid]);
  } catch (error) {
    logger.error({ err: error, emid }, `${STOCK_ALERT_LOG_PREFIX} Error finding low stock products by company`);
    throw new Error('Error finding low stock products by company');
  }
}

const FIND_COMPANY_ID_BY_RUC_QUERY = `
  select emid
  from empresa
  where emruc = $1
`;

async function findCompanyIdByRuc(ruc: string): Promise<string | null> {
  try {
    const rows = await sql.unsafe<CompanyRucResult[]>(FIND_COMPANY_ID_BY_RUC_QUERY, [ruc]);
    const row = rows[0];
    return row?.emid ?? null;
  } catch (error) {
    logger.error({ err: error, ruc }, `${STOCK_ALERT_LOG_PREFIX} Error finding company id by ruc`);
    throw new Error('Error finding company id by ruc');
  }
}

const UPSERT_ALERT_QUERY = `
  insert into alerta (alemid, alsuid, alprdtoid, altipo, almensaje, alcantidadactual, alstockminimo, alstockmaximo)
  values ($1, $2, $3, $4, $5, $6, $7, $8)
  on conflict (alemid, alsuid, alprdtoid) do update set
    alcantidadactual = excluded.alcantidadactual,
    alstockminimo = excluded.alstockminimo,
    alstockmaximo = excluded.alstockmaximo,
    alvisible = true,
    alfchcreacion = current_timestamp
  returning alid
`;

async function upsertAlert(alert: UpsertAlertData): Promise<string> {
  try {
    const result = await sql.unsafe<{ alid: string }[]>(UPSERT_ALERT_QUERY, [
      alert.alemid,
      alert.alsuid,
      alert.alprdtoid,
      alert.altipo,
      alert.almensaje,
      alert.alcantidadactual,
      alert.alstockminimo,
      alert.alstockmaximo,
    ]);
    const alertDB = result[0];
    if (!alertDB) {
      throw new Error('Alert was not upserted');
    }
    return alertDB.alid;
  } catch (error) {
    logger.error({ err: error, emid: alert.alemid, productId: alert.alprdtoid }, `${STOCK_ALERT_LOG_PREFIX} Error upserting alert`);
    throw new Error('Error upserting alert');
  }
}

const HIDE_OBSOLETE_ALERTS_QUERY = `
  update alerta
  set alvisible = false
  where alemid = $1
    and altipo = 'stock_bajo'
    and alvisible = true
    and (
      not exists (
        select 1 from producto p
        where p.prdtoid = alerta.alprdtoid
          and p.prdtoemid = alerta.alemid
          and p.prdtoestado = 'activo'
      )
      or not exists (
        select 1 from sucursal br
        where br.suid = alerta.alsuid
          and br.suemid = alerta.alemid
          and br.suestado = 'activo'
      )
      or not exists (
        select 1 from stock s
        join producto p on p.prdtoid = s.stckprdtoid and p.prdtoemid = s.stckemid
        where s.stckemid = alerta.alemid
          and s.stcksuid = alerta.alsuid
          and s.stckprdtoid = alerta.alprdtoid
          and s.stckestado = 'activo'
          and s.stckcantidad <= p.prdtostockminimo
      )
    )
  returning alid
`;

async function hideObsoleteAlerts(emid: string): Promise<number> {
  try {
    const result = await sql.unsafe<{ alid: string }[]>(HIDE_OBSOLETE_ALERTS_QUERY, [emid]);
    return result.length;
  } catch (error) {
    logger.error({ err: error, emid }, `${STOCK_ALERT_LOG_PREFIX} Error hiding obsolete alerts`);
    throw new Error('Error hiding obsolete alerts');
  }
}

export { findCompanyIdByRuc, findLowStockProductsByCompany, hideObsoleteAlerts, upsertAlert };
