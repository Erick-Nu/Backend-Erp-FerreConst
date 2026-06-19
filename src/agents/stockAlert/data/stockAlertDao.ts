import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';
import type {
  CompanyRucResult,
  ExistingStockAlertResult,
  LowStockProductResult,
  ResolvedAlertResult,
  UpsertAlertData,
  UpsertAlertResult,
  UpsertAlertStatus,
} from './stockAlertModel.js';

const STOCK_ALERT_LOG_PREFIX = '[stockAlertTask]';

const LOW_STOCK_PRODUCT_SELECT_COLUMNS = `
    s.stckemid,
    s.stcksuid,
    s.stckprdtoid,
    s.stckcantidad,
    p.prdtostockminimo,
    p.prdtostockmaximo,
    p.prdtonombre,
    p.prdtocodigo,
    br.sunombre as sucursalnombre
`;

const LOW_STOCK_PRODUCT_RELATION_JOINS = `
  from stock s
  join producto p
    on p.prdtoid = s.stckprdtoid
    and p.prdtoemid = s.stckemid
  join sucursal br
    on br.suid = s.stcksuid
    and br.suemid = s.stckemid
`;

const FIND_LOW_STOCK_PRODUCTS_QUERY = `
  select
${LOW_STOCK_PRODUCT_SELECT_COLUMNS}
${LOW_STOCK_PRODUCT_RELATION_JOINS}
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

const FIND_LOW_STOCK_PRODUCT_BY_STOCK_QUERY = `
  select
${LOW_STOCK_PRODUCT_SELECT_COLUMNS}
${LOW_STOCK_PRODUCT_RELATION_JOINS}
  where s.stckemid = $1
    and s.stcksuid = $2
    and s.stckprdtoid = $3
    and s.stckcantidad <= p.prdtostockminimo
    and s.stckestado = 'activo'
    and p.prdtoestado = 'activo'
    and br.suestado = 'activo'
  limit 1
`;

async function findLowStockProductByStock(
  emid: string,
  suid: string,
  productId: string,
): Promise<LowStockProductResult | null> {
  try {
    const result = await sql.unsafe<LowStockProductResult[]>(FIND_LOW_STOCK_PRODUCT_BY_STOCK_QUERY, [
      emid,
      suid,
      productId,
    ]);
    return result[0] ?? null;
  } catch (error) {
    logger.error(
      { err: error, emid, suid, productId },
      `${STOCK_ALERT_LOG_PREFIX} Error finding low stock product by stock`,
    );
    throw new Error('Error finding low stock product by stock');
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

const FIND_STOCK_ALERT_BY_KEY_QUERY = `
  select
    alid,
    almensaje,
    alcantidadactual,
    alstockminimo,
    alstockmaximo,
    alvisible
  from alerta
  where alemid = $1
    and alsuid = $2
    and alprdtoid = $3
    and altipo = $4
  limit 1
`;

async function findStockAlertByKey(alert: UpsertAlertData): Promise<ExistingStockAlertResult | null> {
  try {
    const result = await sql.unsafe<ExistingStockAlertResult[]>(FIND_STOCK_ALERT_BY_KEY_QUERY, [
      alert.alemid,
      alert.alsuid,
      alert.alprdtoid,
      alert.altipo,
    ]);
    return result[0] ?? null;
  } catch (error) {
    logger.error(
      { err: error, emid: alert.alemid, productId: alert.alprdtoid },
      `${STOCK_ALERT_LOG_PREFIX} Error finding stock alert by key`,
    );
    throw new Error('Error finding stock alert by key');
  }
}

function resolveUpsertAlertStatus(
  existingAlert: ExistingStockAlertResult | null,
  alert: UpsertAlertData,
): UpsertAlertStatus {
  if (!existingAlert) {
    return 'created';
  }

  if (!existingAlert.alvisible) {
    return 'reactivated';
  }

  const hasChanges = existingAlert.almensaje !== alert.almensaje
    || existingAlert.alcantidadactual !== alert.alcantidadactual
    || existingAlert.alstockminimo !== alert.alstockminimo
    || existingAlert.alstockmaximo !== alert.alstockmaximo;

  if (hasChanges) {
    return 'updated';
  }

  return 'unchanged';
}

const UPSERT_ALERT_QUERY = `
  insert into alerta (alemid, alsuid, alprdtoid, altipo, almensaje, alcantidadactual, alstockminimo, alstockmaximo, alfchnotificacion)
  values ($1, $2, $3, $4, $5, $6, $7, $8, current_timestamp)
  on conflict (alemid, alsuid, alprdtoid, altipo) do update set
    almensaje = excluded.almensaje,
    alcantidadactual = excluded.alcantidadactual,
    alstockminimo = excluded.alstockminimo,
    alstockmaximo = excluded.alstockmaximo,
    alvisible = true,
    alvisto = case
      when alerta.alvisible = false then false
      when alerta.alcantidadactual is distinct from excluded.alcantidadactual then false
      when alerta.alstockminimo is distinct from excluded.alstockminimo then false
      when alerta.alstockmaximo is distinct from excluded.alstockmaximo then false
      else alerta.alvisto
    end,
    alfchnotificacion = case
      when alerta.alvisible = false
        or alerta.almensaje is distinct from excluded.almensaje
        or alerta.alcantidadactual is distinct from excluded.alcantidadactual
        or alerta.alstockminimo is distinct from excluded.alstockminimo
        or alerta.alstockmaximo is distinct from excluded.alstockmaximo
      then current_timestamp
      else alerta.alfchnotificacion
    end,
    alfchactualizacion = case
      when alerta.alvisible = false
        or alerta.almensaje is distinct from excluded.almensaje
        or alerta.alcantidadactual is distinct from excluded.alcantidadactual
        or alerta.alstockminimo is distinct from excluded.alstockminimo
        or alerta.alstockmaximo is distinct from excluded.alstockmaximo
      then current_timestamp
      else alerta.alfchactualizacion
    end
  returning alid
`;

const REMIND_ALERT_QUERY = `
  update alerta
  set
    alvisto = false,
    alfchactualizacion = current_timestamp,
    alfchnotificacion = current_timestamp
  where alid = $1
    and alvisible = true
    and alfchnotificacion <= current_timestamp - ($2::int * interval '1 minute')
  returning alid
`;

async function remindAlert(alid: string, reminderMinutes: number): Promise<UpsertAlertResult | null> {
  try {
    const result = await sql.unsafe<{ alid: string }[]>(REMIND_ALERT_QUERY, [alid, reminderMinutes]);
    const alertDB = result[0];

    if (!alertDB) {
      return null;
    }

    return {
      alid: alertDB.alid,
      status: 'reminded',
    };
  } catch (error) {
    logger.error({ err: error, alid, reminderMinutes }, `${STOCK_ALERT_LOG_PREFIX} Error reminding alert`);
    throw new Error('Error reminding alert');
  }
}

async function upsertAlert(alert: UpsertAlertData, reminderMinutes?: number): Promise<UpsertAlertResult> {
  try {
    const existingAlert = await findStockAlertByKey(alert);
    const status = resolveUpsertAlertStatus(existingAlert, alert);

    if (existingAlert && status === 'unchanged') {
      if (typeof reminderMinutes === 'number') {
        const remindedAlert = await remindAlert(existingAlert.alid, reminderMinutes);

        if (remindedAlert) {
          return remindedAlert;
        }
      }

      return {
        alid: existingAlert.alid,
        status,
      };
    }

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
    return {
      alid: alertDB.alid,
      status,
    };
  } catch (error) {
    logger.error(
      { err: error, emid: alert.alemid, productId: alert.alprdtoid },
      `${STOCK_ALERT_LOG_PREFIX} Error upserting alert`,
    );
    throw new Error('Error upserting alert');
  }
}

const HIDE_OBSOLETE_ALERTS_QUERY = `
  update alerta
  set
    alvisible = false,
    alfchactualizacion = current_timestamp
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
  returning alid, alemid, alsuid, alprdtoid, altipo
`;

async function hideObsoleteAlerts(emid: string): Promise<ResolvedAlertResult[]> {
  try {
    return await sql.unsafe<ResolvedAlertResult[]>(HIDE_OBSOLETE_ALERTS_QUERY, [emid]);
  } catch (error) {
    logger.error({ err: error, emid }, `${STOCK_ALERT_LOG_PREFIX} Error hiding obsolete alerts`);
    throw new Error('Error hiding obsolete alerts');
  }
}

const HIDE_ALERT_BY_STOCK_QUERY = `
  update alerta
  set
    alvisible = false,
    alfchactualizacion = current_timestamp
  where alemid = $1
    and alsuid = $2
    and alprdtoid = $3
    and altipo = 'stock_bajo'
    and alvisible = true
  returning alid, alemid, alsuid, alprdtoid, altipo
`;

async function hideAlertByStock(
  emid: string,
  suid: string,
  productId: string,
): Promise<ResolvedAlertResult | null> {
  try {
    const result = await sql.unsafe<ResolvedAlertResult[]>(HIDE_ALERT_BY_STOCK_QUERY, [
      emid,
      suid,
      productId,
    ]);
    return result[0] ?? null;
  } catch (error) {
    logger.error(
      { err: error, emid, suid, productId },
      `${STOCK_ALERT_LOG_PREFIX} Error hiding alert by stock`,
    );
    throw new Error('Error hiding alert by stock');
  }
}

export {
  findCompanyIdByRuc,
  findLowStockProductByStock,
  findLowStockProductsByCompany,
  hideAlertByStock,
  hideObsoleteAlerts,
  upsertAlert,
};
