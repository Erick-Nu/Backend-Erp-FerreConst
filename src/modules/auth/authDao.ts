import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { Role, Status } from '../../config/databaseTypes.js';


type AuthLoginRow = {
  usid: string;
  usemid: string;
  usnombre: string;
  usapodo: string;
  uscorreo: string;
  uspassword: string;
  usimagen: string;
  usrol: Role;
  usestado: Status;
  emid: string;
  emruc: string;
  emrznsocial: string;
  emlogo: string;
  emestado: Status;
  empadre: boolean;
}

const FIND_AUTH_BY_RUC_AND_NICKNAME_QUERY = `
  select
    u.usid,
    u.usemid,
    u.usnombre,
    u.usapodo,
    u.uscorreo,
    u.uspassword,
    u.usimagen,
    u.usrol,
    u.usestado,
    e.emid,
    e.emruc,
    e.emrznsocial,
    e.emlogo,
    e.emestado,
    e.empadre
  from usuario u
  inner join empresa e on e.emid = u.usemid
  where e.emruc = $1 and u.usapodo = $2
`;

async function findAuthByRucAndNickname(ruc: string, nickname: string): Promise<AuthLoginRow | null> {
  try {
    const result = await sql.unsafe<AuthLoginRow[]>(FIND_AUTH_BY_RUC_AND_NICKNAME_QUERY,[ruc, nickname]);
    const authDataDB = result[0];

    if (!authDataDB) {
      return null;
    }

    return authDataDB;
  } catch (error) {
    logger.error(
      { err: error, ruc, nickname },
      'Error finding auth data by ruc and nickname',
    );
    throw new Error('Error finding auth data');
  }
}

export { findAuthByRucAndNickname };
export type { AuthLoginRow };
