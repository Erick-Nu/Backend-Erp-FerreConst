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

type AuthLoginControlScopeDao = {
  authloginemruc: string;
  authloginusapodo: string;
  authloginip: string;
};

type AuthLoginControlRow = {
  authloginid: string;
  authloginemruc: string;
  authloginusapodo: string;
  authloginip: string;
  authloginintentosfallidos: number;
  authloginfchbloqueohasta: Date | null;
  authloginfchultimointento: Date | null;
  authloginfchcreacion: Date;
  authloginfchactualizacion: Date;
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

const FIND_AUTH_LOGIN_CONTROL_BY_SCOPE_QUERY = `
  select
    authloginid,
    authloginemruc,
    authloginusapodo,
    authloginip,
    authloginintentosfallidos,
    authloginfchbloqueohasta,
    authloginfchultimointento,
    authloginfchcreacion,
    authloginfchactualizacion
  from authlogincontrol
  where authloginemruc = $1
    and authloginusapodo = $2
    and authloginip = $3
  limit 1
`;

async function findAuthLoginControlByScope(
  scope: AuthLoginControlScopeDao,
): Promise<AuthLoginControlRow | null> {
  try {
    const result = await sql.unsafe<AuthLoginControlRow[]>(
      FIND_AUTH_LOGIN_CONTROL_BY_SCOPE_QUERY,
      [scope.authloginemruc, scope.authloginusapodo, scope.authloginip],
    );
    const controlDB = result[0];

    if (!controlDB) {
      return null;
    }

    return controlDB;
  } catch (error) {
    logger.error(
      { err: error, scope },
      'Error finding auth login control by scope',
    );
    throw new Error('Error finding auth login control by scope');
  }
}

const REGISTER_AUTH_LOGIN_FAILURE_QUERY = `
  insert into authlogincontrol (
    authloginemruc,
    authloginusapodo,
    authloginip,
    authloginintentosfallidos,
    authloginfchultimointento
  )
  values ($1, $2, $3, 1, current_timestamp)
  on conflict (authloginemruc, authloginusapodo, authloginip)
  do update
  set authloginintentosfallidos = case
        when authlogincontrol.authloginfchbloqueohasta is not null
          and authlogincontrol.authloginfchbloqueohasta <= current_timestamp
        then 1
        else authlogincontrol.authloginintentosfallidos + 1
      end,
      authloginfchbloqueohasta = case
        when (
          case
            when authlogincontrol.authloginfchbloqueohasta is not null
              and authlogincontrol.authloginfchbloqueohasta <= current_timestamp
            then 1
            else authlogincontrol.authloginintentosfallidos + 1
          end
        ) >= $4
        then current_timestamp + ($5 * interval '1 minute')
        else null
      end,
      authloginfchultimointento = current_timestamp,
      authloginfchactualizacion = current_timestamp
  returning
    authloginid,
    authloginemruc,
    authloginusapodo,
    authloginip,
    authloginintentosfallidos,
    authloginfchbloqueohasta,
    authloginfchultimointento,
    authloginfchcreacion,
    authloginfchactualizacion
`;

async function registerAuthLoginFailure(
  scope: AuthLoginControlScopeDao,
  maxFailedAttempts: number,
  lockDurationMinutes: number,
): Promise<AuthLoginControlRow> {
  try {
    const result = await sql.unsafe<AuthLoginControlRow[]>(
      REGISTER_AUTH_LOGIN_FAILURE_QUERY,
      [
        scope.authloginemruc,
        scope.authloginusapodo,
        scope.authloginip,
        maxFailedAttempts,
        lockDurationMinutes,
      ],
    );
    const controlDB = result[0];

    if (!controlDB) {
      throw new Error('Auth login failure was not registered');
    }

    return controlDB;
  } catch (error) {
    logger.error(
      { err: error, scope },
      'Error registering auth login failure',
    );
    throw new Error('Error registering auth login failure');
  }
}

const RESET_AUTH_LOGIN_CONTROL_QUERY = `
  update authlogincontrol
  set authloginintentosfallidos = 0,
      authloginfchbloqueohasta = null,
      authloginfchultimointento = null,
      authloginfchactualizacion = current_timestamp
  where authloginemruc = $1
    and authloginusapodo = $2
    and authloginip = $3
  returning authloginid
`;

async function resetAuthLoginControl(scope: AuthLoginControlScopeDao): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ authloginid: string }[]>(
      RESET_AUTH_LOGIN_CONTROL_QUERY,
      [scope.authloginemruc, scope.authloginusapodo, scope.authloginip],
    );
    const controlDB = result[0];

    if (!controlDB) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      { err: error, scope },
      'Error resetting auth login control',
    );
    throw new Error('Error resetting auth login control');
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
  findAuthLoginControlByScope,
  registerAuthLoginFailure,
  resetAuthLoginControl,
  createAuthRefreshToken,
  findAuthRefreshTokenByHash,
  revokeAuthRefreshTokenById,
  revokeAuthRefreshTokenByHash,
};
export type {
  AuthLoginRow,
  AuthLoginControlRow,
  AuthLoginControlScopeDao,
  AuthRefreshTokenRow,
  CreateAuthRefreshTokenDao,
};
