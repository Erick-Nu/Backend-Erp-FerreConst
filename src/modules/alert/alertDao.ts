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
};

type AlertRowWithJoinsDao = AlertRowDao & {
  suidentificador?: string | null;
  sunombre?: string | null;
  prdtocodigo?: string | null;
  prdtonombre?: string | null;
};

const FIND_ALERTS_BY_COMPANY_QUERY = `
  select
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
    s.suidentificador,
    s.sunombre,
    p.prdtocodigo,
    p.prdtonombre
  from alerta a
  left join sucursal s
    on s.suid = a.alsuid
    and s.suemid = a.alemid
  left join producto p
    on p.prdtoid = a.alprdtoid
    and p.prdtoemid = a.alemid
  where a.alemid = $1
    and a.alvisible = true
  order by a.alfchcreacion desc
  limit $2
  offset $3
`;

const COUNT_ALERTS_BY_COMPANY_QUERY = `
  select count(*)::int as total
  from alerta
  where alemid = $1
    and alvisible = true
`;

const FIND_ALERTS_BY_COMPANY_AND_BRANCH_QUERY = `
  select
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
    s.suidentificador,
    s.sunombre,
    p.prdtocodigo,
    p.prdtonombre
  from alerta a
  left join sucursal s
    on s.suid = a.alsuid
    and s.suemid = a.alemid
  left join producto p
    on p.prdtoid = a.alprdtoid
    and p.prdtoemid = a.alemid
  where a.alemid = $1
    and a.alsuid = $2
    and a.alvisible = true
  order by a.alfchcreacion desc
  limit $3
  offset $4
`;

const COUNT_ALERTS_BY_COMPANY_AND_BRANCH_QUERY = `
  select count(*)::int as total
  from alerta
  where alemid = $1
    and alsuid = $2
    and alvisible = true
`;

async function findAlertsByCompany(
  emid: string,
  limit: number,
  offset: number,
): Promise<AlertRowWithJoinsDao[]> {
  try {
    return await sql.unsafe<AlertRowWithJoinsDao[]>(FIND_ALERTS_BY_COMPANY_QUERY, [emid, limit, offset]);
  } catch (error) {
    logger.error({ err: error, emid }, 'Error finding alerts by company');
    throw new Error('Error finding alerts by company');
  }
}

async function countAlertsByCompany(emid: string): Promise<number> {
  try {
    const result = await sql.unsafe<{ total: number }[]>(COUNT_ALERTS_BY_COMPANY_QUERY, [emid]);
    const row = result[0];
    return row?.total ?? 0;
  } catch (error) {
    logger.error({ err: error, emid }, 'Error counting alerts by company');
    throw new Error('Error counting alerts by company');
  }
}

async function findAlertsByCompanyAndBranch(
  emid: string,
  suid: string,
  limit: number,
  offset: number,
): Promise<AlertRowWithJoinsDao[]> {
  try {
    return await sql.unsafe<AlertRowWithJoinsDao[]>(FIND_ALERTS_BY_COMPANY_AND_BRANCH_QUERY, [
      emid,
      suid,
      limit,
      offset,
    ]);
  } catch (error) {
    logger.error({ err: error, emid, suid }, 'Error finding alerts by company and branch');
    throw new Error('Error finding alerts by company and branch');
  }
}

async function countAlertsByCompanyAndBranch(emid: string, suid: string): Promise<number> {
  try {
    const result = await sql.unsafe<{ total: number }[]>(COUNT_ALERTS_BY_COMPANY_AND_BRANCH_QUERY, [
      emid,
      suid,
    ]);
    const row = result[0];
    return row?.total ?? 0;
  } catch (error) {
    logger.error({ err: error, emid, suid }, 'Error counting alerts by company and branch');
    throw new Error('Error counting alerts by company and branch');
  }
}

const MARK_ALERT_AS_VIEWED_QUERY = `
  update alerta
  set alvisto = true
  where alid = $1 and alemid = $2
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

const FIND_RECENT_UNSEEN_ALERTS_QUERY = `
  select
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
    s.suidentificador,
    s.sunombre,
    p.prdtocodigo,
    p.prdtonombre
  from alerta a
  left join sucursal s
    on s.suid = a.alsuid
    and s.suemid = a.alemid
  left join producto p
    on p.prdtoid = a.alprdtoid
    and p.prdtoemid = a.alemid
  where a.alemid = $1
    and a.alfchcreacion > $2
    and a.alvisible = true
  order by a.alfchcreacion asc
`;

async function findRecentUnseenAlerts(emid: string, since: Date): Promise<AlertRowWithJoinsDao[]> {
  try {
    return await sql.unsafe<AlertRowWithJoinsDao[]>(FIND_RECENT_UNSEEN_ALERTS_QUERY, [emid, since]);
  } catch (error) {
    logger.error({ err: error, emid }, 'Error finding recent unseen alerts');
    throw new Error('Error finding recent unseen alerts');
  }
}

export type { AlertRowWithJoinsDao };

export {
  findAlertsByCompany,
  countAlertsByCompany,
  findAlertsByCompanyAndBranch,
  countAlertsByCompanyAndBranch,
  markAlertAsViewed,
  findRecentUnseenAlerts,
};
