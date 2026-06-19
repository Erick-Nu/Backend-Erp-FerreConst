import { createHash, randomBytes } from 'node:crypto';

import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { signAccessToken } from '../../utils/jwt.js';
import { verifyPassword } from '../../utils/bcrypt.js';
import { validateRequiredString, validateRuc } from '../../utils/validation.js';
import { toPublicImageUrl } from '../../middlewares/uploadImage.js';
import type {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from './authDto.js';
import {
  createAuthRefreshToken,
  findAuthByRucAndNickname,
  findAuthLoginControlByScope,
  findAuthRefreshTokenByHash,
  saveAuthLoginControl,
  resetAuthLoginControl,
  revokeAuthRefreshTokenByHash,
  revokeAuthRefreshTokenById,
} from './authDao.js';
import type { AuthLoginControlRow, AuthLoginControlScopeDao } from './authDao.js';

const EMPTY_RUC_MESSAGE = 'El RUC de la empresa es requerido';
const EMPTY_NICKNAME_MESSAGE = 'El apodo es requerido';
const EMPTY_PASSWORD_MESSAGE = 'La contraseña es requerida';
const EMPTY_REFRESH_TOKEN_MESSAGE = 'El token de refresco es requerido';
const INACTIVE_USER_MESSAGE = 'El usuario esta inactivo';
const INACTIVE_COMPANY_MESSAGE = 'La empresa esta inactiva';
const UNAUTHORIZED_MESSAGE = 'No autorizado';
const TOO_MANY_REQUESTS_MESSAGE = 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos';
const TOO_MANY_REQUESTS_STATUS_CODE = 429;
const HOUR_TO_MILLISECONDS = 60 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 3;
const LOGIN_LOCK_DURATION_MINUTES = 15;

type AuthMetadata = {
  ip: string | null;
  userAgent: string | null;
};

function createHttpError(message: string, statusCode: number): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function createUnauthorizedError(): Error & { statusCode: number } {
  return createHttpError(UNAUTHORIZED_MESSAGE, 401);
}

function createTooManyRequestsError(): Error & { statusCode: number } {
  return createHttpError(TOO_MANY_REQUESTS_MESSAGE, TOO_MANY_REQUESTS_STATUS_CODE);
}

function normalizeAuthIp(ip: string | null): string {
  if (!ip) {
    return '';
  }

  return ip;
}

function hasActiveLoginLock(lockUntil: Date | null): boolean {
  if (!lockUntil) {
    return false;
  }

  return lockUntil.getTime() > Date.now();
}

function calculateFailedAttemptState(
  currentControl: AuthLoginControlRow | null,
): { failedAttempts: number; lockUntil: Date | null } {
  const now = Date.now();
  const isExpiredLock = Boolean(
    currentControl?.authloginfchbloqueohasta
      && currentControl.authloginfchbloqueohasta.getTime() <= now,
  );

  const failedAttempts = isExpiredLock
    ? 1
    : (currentControl?.authloginintentosfallidos ?? 0) + 1;

  const lockUntil = failedAttempts >= LOGIN_MAX_FAILED_ATTEMPTS
    ? new Date(now + (LOGIN_LOCK_DURATION_MINUTES * 60 * 1000))
    : null;

  return {
    failedAttempts,
    lockUntil,
  };
}

async function handleFailedLoginAttempt(
  loginControlScope: AuthLoginControlScopeDao,
  currentControl: AuthLoginControlRow | null,
): Promise<never> {
  const failedAttemptState = calculateFailedAttemptState(currentControl);
  const failedAttempt = await saveAuthLoginControl(
    loginControlScope,
    failedAttemptState.failedAttempts,
    failedAttemptState.lockUntil,
  );

  if (hasActiveLoginLock(failedAttempt.authloginfchbloqueohasta)) {
    throw createTooManyRequestsError();
  }

  throw createUnauthorizedError();
}

function generateRefreshTokenValue(): string {
  return randomBytes(48).toString('hex');
}

function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function getRefreshTokenExpirationDate(): Date {
  return new Date(
    Date.now() + (env.refreshTokenExpiresInHours * HOUR_TO_MILLISECONDS),
  );
}

function hasRefreshTokenExpired(expirationDate: Date): boolean {
  return expirationDate.getTime() <= Date.now();
}

async function issueRefreshToken(authusid: string, metadata: AuthMetadata): Promise<string> {
  const refreshToken = generateRefreshTokenValue();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expirationDate = getRefreshTokenExpirationDate();

  await createAuthRefreshToken({
    authusid,
    authtokenhash: refreshTokenHash,
    authfchexpiracion: expirationDate,
    authip: metadata.ip,
    authuseragent: metadata.userAgent,
  });

  return refreshToken;
}

async function login(credentials: LoginDto, metadata: AuthMetadata): Promise<LoginResponseDto> {
  const emruc = validateRequiredString(credentials.emruc, EMPTY_RUC_MESSAGE);
  validateRuc(emruc);
  const usapodo = validateRequiredString(credentials.usapodo, EMPTY_NICKNAME_MESSAGE);
  const uspassword = validateRequiredString(credentials.uspassword, EMPTY_PASSWORD_MESSAGE);
  const authloginip = normalizeAuthIp(metadata.ip);
  const loginControlScope = {
    authloginemruc: emruc,
    authloginusapodo: usapodo,
    authloginip,
  };

  try {
    const loginControl = await findAuthLoginControlByScope(loginControlScope);

    if (hasActiveLoginLock(loginControl?.authloginfchbloqueohasta ?? null)) {
      throw createTooManyRequestsError();
    }

    const authDataDB = await findAuthByRucAndNickname(emruc, usapodo);

    if (!authDataDB) {
      await handleFailedLoginAttempt(loginControlScope, loginControl);
    }
    if (!authDataDB) {
      throw createUnauthorizedError();
    }

    if (authDataDB.emestado !== 'activo'){
      throw new Error(INACTIVE_COMPANY_MESSAGE);
    }

    const verifyPasswordDB = await verifyPassword(uspassword, authDataDB.uspassword);
    
    if (!verifyPasswordDB) {
      await handleFailedLoginAttempt(loginControlScope, loginControl);
    }

    if (authDataDB.usestado !== 'activo') {
      throw new Error(INACTIVE_USER_MESSAGE);
    }

    await resetAuthLoginControl(loginControlScope);

    const userToken = signAccessToken({
      usid: authDataDB.usid,
      usemid: authDataDB.emid,
      usrol: authDataDB.usrol,
    });
    const refreshToken = await issueRefreshToken(authDataDB.usid, metadata);

    const loginResponse: LoginResponseDto = {
      accessToken: userToken,
      refreshToken,
      company: {
        emid: authDataDB.emid,
        emruc: authDataDB.emruc,
        emrznsocial: authDataDB.emrznsocial,
        emlogo: toPublicImageUrl(authDataDB.emlogo),
        emestado: authDataDB.emestado,
        empadre: authDataDB.empadre
      },
      user: {
        usid: authDataDB.usid,
        usemid: authDataDB.usemid,
        usnombre: authDataDB.usnombre,
        usapodo: authDataDB.usapodo,
        uscorreo: authDataDB.uscorreo,
        usimagen: toPublicImageUrl(authDataDB.usimagen),
        usrol: authDataDB.usrol,
        usestado: authDataDB.usestado
      }
    }
    return loginResponse;
  } catch (error) {
    logger.error({ err: error, companyId: credentials.emruc, usuario: credentials.usapodo }, 'Error User Login');
    throw error;
  }
}

async function refreshSession(
  refreshData: RefreshTokenDto,
  metadata: AuthMetadata,
): Promise<RefreshTokenResponseDto> {
  const refreshToken = validateRequiredString(
    refreshData.refreshToken,
    EMPTY_REFRESH_TOKEN_MESSAGE,
  );

  try {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const refreshTokenDB = await findAuthRefreshTokenByHash(refreshTokenHash);

    if (!refreshTokenDB) {
      throw createUnauthorizedError();
    }

    if (refreshTokenDB.authfchrevocacion) {
      throw createUnauthorizedError();
    }

    if (hasRefreshTokenExpired(refreshTokenDB.authfchexpiracion)) {
      await revokeAuthRefreshTokenById(refreshTokenDB.authid);
      throw createUnauthorizedError();
    }

    if (refreshTokenDB.usestado !== 'activo') {
      throw createHttpError(INACTIVE_USER_MESSAGE, 401);
    }

    if (refreshTokenDB.emestado !== 'activo') {
      throw createHttpError(INACTIVE_COMPANY_MESSAGE, 401);
    }

    await revokeAuthRefreshTokenById(refreshTokenDB.authid);

    const accessToken = signAccessToken({
      usid: refreshTokenDB.usid,
      usemid: refreshTokenDB.usemid,
      usrol: refreshTokenDB.usrol,
    });

    const newRefreshToken = await issueRefreshToken(refreshTokenDB.authusid, metadata);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    logger.error({ err: error }, 'Error refreshing session');
    throw error;
  }
}

async function logout(refreshData: RefreshTokenDto): Promise<void> {
  const refreshToken = validateRequiredString(
    refreshData.refreshToken,
    EMPTY_REFRESH_TOKEN_MESSAGE,
  );

  try {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    await revokeAuthRefreshTokenByHash(refreshTokenHash);
  } catch (error) {
    logger.error({ err: error }, 'Error logging out user');
    throw error;
  }
}

export { login, logout, refreshSession };
