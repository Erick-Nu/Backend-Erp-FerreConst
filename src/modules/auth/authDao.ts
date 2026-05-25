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
};

type CreateAuthRefreshTokenDao = {
  authusid: string;
  authtokenhash: string;
  authfchexpiracion: Date;
  authip: string | null;
  authuseragent: string | null;
};

type AuthRefreshTokenRow = {
  authid: string;
  authusid: string;
  authtokenhash: string;
  authfchexpiracion: Date;
  authfchcreacion: Date;
  authfchuso: Date | null;
  authfchrevocacion: Date | null;
  usid: string;
  usemid: string;
  usrol: Role;
  usestado: Status;
  emid: string;
  emestado: Status;
};

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

const CREATE_AUTH_REFRESH_TOKEN_QUERY = `
  insert into authrefreshtoken (
    authusid,
    authtokenhash,
    authfchexpiracion,
    authip,
    authuseragent
  )
  values ($1, $2, $3, $4, $5)
  returning authid
`;

async function createAuthRefreshToken(tokenData: CreateAuthRefreshTokenDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ authid: string }[]>(CREATE_AUTH_REFRESH_TOKEN_QUERY, [
      tokenData.authusid,
      tokenData.authtokenhash,
      tokenData.authfchexpiracion,
      tokenData.authip,
      tokenData.authuseragent,
    ]);

    const tokenDB = result[0];
    if (!tokenDB) {
      throw new Error('Refresh token was not created');
    }

    return tokenDB.authid;
  } catch (error) {
    logger.error(
      { err: error, userId: tokenData.authusid },
      'Error creating auth refresh token',
    );
    throw new Error('Error creating auth refresh token');
  }
}

const FIND_AUTH_REFRESH_TOKEN_BY_HASH_QUERY = `
  select
    art.authid,
    art.authusid,
    art.authtokenhash,
    art.authfchexpiracion,
    art.authfchcreacion,
    art.authfchuso,
    art.authfchrevocacion,
    u.usid,
    u.usemid,
    u.usrol,
    u.usestado,
    e.emid,
    e.emestado
  from authrefreshtoken art
  inner join usuario u on u.usid = art.authusid
  inner join empresa e on e.emid = u.usemid
  where art.authtokenhash = $1
  limit 1
`;

async function findAuthRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRow | null> {
  try {
    const result = await sql.unsafe<AuthRefreshTokenRow[]>(FIND_AUTH_REFRESH_TOKEN_BY_HASH_QUERY, [tokenHash]);
    const tokenDB = result[0];

    if (!tokenDB) {
      return null;
    }

    return tokenDB;
  } catch (error) {
    logger.error({ err: error }, 'Error finding auth refresh token by hash');
    throw new Error('Error finding auth refresh token by hash');
  }
}

const REVOKE_AUTH_REFRESH_TOKEN_BY_ID_QUERY = `
  update authrefreshtoken
  set authfchuso = current_timestamp,
      authfchrevocacion = current_timestamp
  where authid = $1 and authfchrevocacion is null
  returning authid
`;

async function revokeAuthRefreshTokenById(authid: string): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ authid: string }[]>(REVOKE_AUTH_REFRESH_TOKEN_BY_ID_QUERY, [authid]);
    const tokenDB = result[0];

    if (!tokenDB) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error, authid }, 'Error revoking auth refresh token by id');
    throw new Error('Error revoking auth refresh token by id');
  }
}

const REVOKE_AUTH_REFRESH_TOKEN_BY_HASH_QUERY = `
  update authrefreshtoken
  set authfchuso = current_timestamp,
      authfchrevocacion = current_timestamp
  where authtokenhash = $1 and authfchrevocacion is null
  returning authid
`;

async function revokeAuthRefreshTokenByHash(tokenHash: string): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ authid: string }[]>(REVOKE_AUTH_REFRESH_TOKEN_BY_HASH_QUERY, [tokenHash]);
    const tokenDB = result[0];

    if (!tokenDB) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error }, 'Error revoking auth refresh token by hash');
    throw new Error('Error revoking auth refresh token by hash');
  }
}

export { findAuthByRucAndNickname };
export {
  createAuthRefreshToken,
  findAuthRefreshTokenByHash,
  revokeAuthRefreshTokenById,
  revokeAuthRefreshTokenByHash,
};
export type {
  AuthLoginRow,
  AuthRefreshTokenRow,
  CreateAuthRefreshTokenDao,
};
