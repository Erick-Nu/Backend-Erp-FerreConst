import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

type AlertRowDao = {
  alid: string;
  alemid: string;
  alsuid: string;
  alprdtoid: string;
  altipo: string;
  almensaje: string;
  alcantidadactual: number;
  alstockminimo: number;
  alstockmaximo: number;
  alvisible: boolean;
  alvisto: boolean;
  alfchcreacion: Date;
  alfchactualizacion: Date;
};

type AlertRowWithJoinsDao = AlertRowDao & {
  suidentificador?: string | null;
  sunombre?: string | null;
  prdtocodigo?: string | null;
  prdtonombre?: string | null;
};

type AlertEventTypeDao = 'alert-created' | 'alert-updated' | 'alert-resolved';

type AlertEventRowDao = AlertRowWithJoinsDao & {
  aleventtype: AlertEventTypeDao;
};

type FindAlertsFiltersDao = {
  emid: string;
  suid?: string;
  tipo?: string;
  visible?: boolean;
  visto?: boolean;
};

type FindAlertsPageDao = FindAlertsFiltersDao & {
  limit: number;
  offset: number;
};

type AlertSummaryTotalsDao = {
  totalvisible: number;
  totalunseen: number;
};

type AlertSummaryTypeDao = {
  type: string;
  totalvisible: number;
  totalunseen: number;
};

type AlertSummaryBranchDao = {
  suid: string;
  sunombre: string | null;
  suidentificador: string | null;
  totalvisible: number;
  totalunseen: number;
};

type QueryValue = string | boolean | number | Date;

type QueryWithValues = {
  query: string;
  values: QueryValue[];
};

const ALERT_SELECT_COLUMNS = `
    a.alid,
    a.alemid,
    a.alsuid,
    a.alprdtoid,
    a.altipo,
    a.almensaje,
    a.alcantidadactual,
    a.alstockminimo,
    a.alstockmaximo,
    a.alvisible,
    a.alvisto,
    a.alfchcreacion,
    a.alfchactualizacion,
    s.suidentificador,
    s.sunombre,
    p.prdtocodigo,
    p.prdtonombre
`;

const ALERT_RELATION_JOINS = `
  left join sucursal s
    on s.suid = a.alsuid
    and s.suemid = a.alemid
  left join producto p
    on p.prdtoid = a.alprdtoid
    and p.prdtoemid = a.alemid
`;

function buildAlertWhereClause(filters: FindAlertsFiltersDao): {
  clause: string;
  values: QueryValue[];
} {
  const conditions = ['a.alemid = $1'];
  const values: QueryValue[] = [filters.emid];

  if (filters.suid !== undefined) {
    values.push(filters.suid);
    conditions.push(`a.alsuid = $${values.length}`);
  }

  if (filters.tipo !== undefined) {
    values.push(filters.tipo);
    conditions.push(`a.altipo = $${values.length}`);
  }

  if (filters.visible !== undefined) {
    values.push(filters.visible);
    conditions.push(`a.alvisible = $${values.length}`);
  }

  if (filters.visto !== undefined) {
    values.push(filters.visto);
    conditions.push(`a.alvisto = $${values.length}`);
  }

  return {
    clause: conditions.join(' and '),
    values,
  };
}

const buildFindAlertsQuery = (filters: FindAlertsPageDao): QueryWithValues => {
  const where = buildAlertWhereClause(filters);
  const values = [...where.values, filters.limit, filters.offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const query = `
  select
${ALERT_SELECT_COLUMNS}
  from alerta a
${ALERT_RELATION_JOINS}
  where ${where.clause}
  order by a.alfchactualizacion desc, a.alfchcreacion desc
  limit $${limitParamIndex}
  offset $${offsetParamIndex}
`;

  return { query, values };
};

const buildCountAlertsQuery = (filters: FindAlertsFiltersDao): QueryWithValues => {
  const where = buildAlertWhereClause(filters);
  const query = `
    select count(*)::int as total
    from alerta a
    where ${where.clause}
  `;

  return { query, values: where.values };
};

async function findAlerts(filters: FindAlertsPageDao): Promise<AlertRowWithJoinsDao[]> {
  try {
    const { query, values } = buildFindAlertsQuery(filters);
    return await sql.unsafe<AlertRowWithJoinsDao[]>(query, values);
  } catch (error) {
    logger.error({ err: error, filters }, 'Error finding alerts');
    throw new Error('Error finding alerts');
  }
}

async function countAlerts(filters: FindAlertsFiltersDao): Promise<number> {
  try {
    const { query, values } = buildCountAlertsQuery(filters);
    const result = await sql.unsafe<{ total: number }[]>(query, values);
    const row = result[0];
    return row?.total ?? 0;
  } catch (error) {
    logger.error({ err: error, filters }, 'Error counting alerts');
    throw new Error('Error counting alerts');
  }
}

const MARK_ALERT_AS_VIEWED_QUERY = `
  update alerta
  set alvisto = true
  where alid = $1
    and alemid = $2
    and alvisible = true
  returning alid
`;

async function markAlertAsViewed(alid: string, alemid: string): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ alid: string }[]>(MARK_ALERT_AS_VIEWED_QUERY, [alid, alemid]);
    const row = result[0];
    return row !== undefined;
  } catch (error) {
    logger.error({ err: error, alid }, 'Error marking alert as viewed');
    throw new Error('Error marking alert as viewed');
  }
}

const FIND_RECENT_CHANGED_ALERTS_QUERY = `
  select
${ALERT_SELECT_COLUMNS},
    case
      when a.alvisible = false then 'alert-resolved'
      when a.alfchcreacion = a.alfchactualizacion then 'alert-created'
      else 'alert-updated'
    end as aleventtype
  from alerta a
${ALERT_RELATION_JOINS}
  where a.alemid = $1
    and (
      a.alfchactualizacion > $2
      or (
        a.alfchactualizacion = $2
        and a.alid > $3
      )
    )
  order by a.alfchactualizacion asc, a.alid asc
`;

async function findRecentChangedAlerts(
  emid: string,
  sinceUpdatedAt: Date,
  sinceAlertId: string,
): Promise<AlertEventRowDao[]> {
  try {
    return await sql.unsafe<AlertEventRowDao[]>(
      FIND_RECENT_CHANGED_ALERTS_QUERY,
      [emid, sinceUpdatedAt, sinceAlertId],
    );
  } catch (error) {
    logger.error(
      { err: error, emid, sinceUpdatedAt, sinceAlertId },
      'Error finding recent changed alerts',
    );
    throw new Error('Error finding recent changed alerts');
  }
}

const FIND_ALERT_SUMMARY_TOTALS_QUERY = `
  select
    count(*) filter (where alvisible = true)::int as totalvisible,
    count(*) filter (where alvisible = true and alvisto = false)::int as totalunseen
  from alerta
  where alemid = $1
`;

const FIND_ALERT_SUMMARY_BY_TYPE_QUERY = `
  select
    altipo as type,
    count(*)::int as totalvisible,
    count(*) filter (where alvisto = false)::int as totalunseen
  from alerta
  where alemid = $1
    and alvisible = true
  group by altipo
  order by altipo asc
`;

const FIND_ALERT_SUMMARY_BY_BRANCH_QUERY = `
  select
    a.alsuid as suid,
    s.sunombre,
    s.suidentificador,
    count(*)::int as totalvisible,
    count(*) filter (where a.alvisto = false)::int as totalunseen
  from alerta a
  left join sucursal s
    on s.suid = a.alsuid
    and s.suemid = a.alemid
  where a.alemid = $1
    and a.alvisible = true
  group by a.alsuid, s.sunombre, s.suidentificador
  order by s.sunombre asc nulls last, a.alsuid asc
`;

async function findAlertSummaryTotals(emid: string): Promise<AlertSummaryTotalsDao> {
  try {
    const result = await sql.unsafe<AlertSummaryTotalsDao[]>(FIND_ALERT_SUMMARY_TOTALS_QUERY, [emid]);
    return result[0] ?? { totalvisible: 0, totalunseen: 0 };
  } catch (error) {
    logger.error({ err: error, emid }, 'Error finding alert summary totals');
    throw new Error('Error finding alert summary totals');
  }
}

async function findAlertSummaryByType(emid: string): Promise<AlertSummaryTypeDao[]> {
  try {
    return await sql.unsafe<AlertSummaryTypeDao[]>(FIND_ALERT_SUMMARY_BY_TYPE_QUERY, [emid]);
  } catch (error) {
    logger.error({ err: error, emid }, 'Error finding alert summary by type');
    throw new Error('Error finding alert summary by type');
  }
}

async function findAlertSummaryByBranch(emid: string): Promise<AlertSummaryBranchDao[]> {
  try {
    return await sql.unsafe<AlertSummaryBranchDao[]>(FIND_ALERT_SUMMARY_BY_BRANCH_QUERY, [emid]);
  } catch (error) {
    logger.error({ err: error, emid }, 'Error finding alert summary by branch');
    throw new Error('Error finding alert summary by branch');
  }
}

export type {
  AlertEventRowDao,
  AlertEventTypeDao,
  AlertRowWithJoinsDao,
  AlertSummaryBranchDao,
  AlertSummaryTotalsDao,
  AlertSummaryTypeDao,
  FindAlertsFiltersDao,
  FindAlertsPageDao,
};

export {
  countAlerts,
  findAlertSummaryByBranch,
  findAlertSummaryByType,
  findAlertSummaryTotals,
  findAlerts,
  findRecentChangedAlerts,
  markAlertAsViewed,
};
