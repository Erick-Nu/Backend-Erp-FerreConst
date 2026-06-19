import type { Response } from 'express';
import { logger } from '../../utils/logger.js';
import { findCompanyById } from '../company/companyDao.js';
import { findBranchById } from '../branch/branchDao.js';
import { findUserById } from '../user/userDao.js';
import type { LoginUserDto } from '../auth/authDto.js';
import { createSSEConnection, sendSSEData } from '../../services/sseManager.js';
import {
  countAlerts,
  findAlertSummaryByBranch,
  findAlertSummaryByType,
  findAlertSummaryTotals,
  findAlerts,
  findRecentChangedAlerts,
  markAlertAsViewed,
} from './alertDao.js';
import type {
  AlertResponseDto,
  AlertSummaryResponseDto,
  FindAlertsParamsDto,
  FindAlertsResponseDto,
} from './alertDto.js';
import type { AlertEventRowDao, AlertRowWithJoinsDao, FindAlertsFiltersDao } from './alertDao.js';

const SSE_POLL_INTERVAL_MS = 5000;
const SSE_CURSOR_INITIAL_ALERT_ID = '';
const EMPTY_ALERT_ID_MESSAGE = 'El id de alerta es requerido';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no esta activo';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const INVALID_PAGE_MESSAGE = 'La página debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamaño de página debe ser un entero positivo';
const INVALID_BRANCH_NOT_FOUND_MESSAGE = 'La sucursal no existe';
const ALERT_NOT_FOUND_MESSAGE = 'Alerta no encontrada';
const BAD_REQUEST_STATUS_CODE = 400;
const FORBIDDEN_STATUS_CODE = 403;
const NOT_FOUND_STATUS_CODE = 404;

type AccessOptions = {
  targetCompanyId: string;
};

type ErrorWithStatusCode = Error & {
  statusCode: number;
};

function createErrorWithStatusCode(message: string, statusCode: number): ErrorWithStatusCode {
  const error = new Error(message) as ErrorWithStatusCode;
  error.statusCode = statusCode;

  return error;
}

function mapAlertRowToResponse(alert: AlertRowWithJoinsDao): AlertResponseDto {
  return {
    alid: alert.alid,
    alemid: alert.alemid,
    branch: {
      suid: alert.alsuid,
      sunombre: alert.sunombre ?? null,
      suidentificador: alert.suidentificador ?? null,
    },
    product: {
      prdtoid: alert.alprdtoid,
      prdtocodigo: alert.prdtocodigo ?? null,
      prdtonombre: alert.prdtonombre ?? null,
    },
    altipo: alert.altipo,
    almensaje: alert.almensaje,
    alcantidadactual: alert.alcantidadactual,
    alstockminimo: alert.alstockminimo,
    alstockmaximo: alert.alstockmaximo,
    alvisible: alert.alvisible,
    alvisto: alert.alvisto,
    alfchcreacion: alert.alfchcreacion,
    alfchactualizacion: alert.alfchactualizacion,
  };
}

function mapAlertEventToResponse(alert: AlertEventRowDao): AlertResponseDto {
  return mapAlertRowToResponse(alert);
}

async function validateAlertAccess(user: LoginUserDto, options: AccessOptions): Promise<void> {
  const { targetCompanyId } = options;

  const company = await findCompanyById(user.usemid);
  if (!company) {
    throw createErrorWithStatusCode(INVALID_COMPANY_FIND_MESSAGE, NOT_FOUND_STATUS_CODE);
  }

  if (company.emestado !== 'activo') {
    throw createErrorWithStatusCode(INVALID_COMPANY_STATUS_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  const userCompany = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!userCompany) {
    throw createErrorWithStatusCode(INVALID_USER_NOT_FOUND_MESSAGE, NOT_FOUND_STATUS_CODE);
  }

  if (userCompany.usemid !== user.usemid) {
    throw createErrorWithStatusCode(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  if (targetCompanyId !== user.usemid) {
    throw createErrorWithStatusCode(FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  if (!['jefe', 'empleado', 'administrador'].includes(userCompany.usrol)) {
    throw createErrorWithStatusCode(FORBIDDEN_ROL_USER_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  if (userCompany.usestado !== 'activo') {
    throw createErrorWithStatusCode(INVALID_USER_STATUS_MESSAGE, FORBIDDEN_STATUS_CODE);
  }
}

async function readAlerts(
  params: FindAlertsParamsDto,
  user: LoginUserDto,
): Promise<FindAlertsResponseDto> {
  const { suid, tipo, visto, page, pageSize } = params;
  const visible = params.visible ?? true;

  if (!Number.isInteger(page) || page < 1) {
    throw createErrorWithStatusCode(INVALID_PAGE_MESSAGE, BAD_REQUEST_STATUS_CODE);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw createErrorWithStatusCode(INVALID_PAGE_SIZE_MESSAGE, BAD_REQUEST_STATUS_CODE);
  }

  try {
    await validateAlertAccess(user, { targetCompanyId: user.usemid });

    const offset = (page - 1) * pageSize;

    if (suid) {
      const branch = await findBranchById({ suid, suemid: user.usemid });
      if (!branch) {
        throw createErrorWithStatusCode(INVALID_BRANCH_NOT_FOUND_MESSAGE, NOT_FOUND_STATUS_CODE);
      }
    }

    const filters: FindAlertsFiltersDao = {
      emid: user.usemid,
      visible,
    };

    if (suid !== undefined) {
      filters.suid = suid;
    }

    if (tipo !== undefined) {
      filters.tipo = tipo;
    }

    if (visto !== undefined) {
      filters.visto = visto;
    }

    const [items, totalItems] = await Promise.all([
      findAlerts({ ...filters, limit: pageSize, offset }),
      countAlerts(filters),
    ]);

    return {
      items: items.map(mapAlertRowToResponse),
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  } catch (error) {
    logger.error(
      { err: error, page, pageSize, branchId: suid, requesterCompanyId: user.usemid },
      'Error reading alerts',
    );
    throw error;
  }
}

async function readAlertAsViewed(alid: string, user: LoginUserDto): Promise<boolean> {
  const validatedId = alid.trim();

  if (validatedId.length === 0) {
    throw createErrorWithStatusCode(EMPTY_ALERT_ID_MESSAGE, BAD_REQUEST_STATUS_CODE);
  }

  try {
    await validateAlertAccess(user, { targetCompanyId: user.usemid });

    const updated = await markAlertAsViewed(validatedId, user.usemid);

    if (!updated) {
      throw createErrorWithStatusCode(ALERT_NOT_FOUND_MESSAGE, NOT_FOUND_STATUS_CODE);
    }

    return true;
  } catch (error) {
    logger.error(
      { err: error, alertId: validatedId, requesterCompanyId: user.usemid },
      'Error marking alert as viewed',
    );
    throw error;
  }
}

async function readAlertSummary(user: LoginUserDto): Promise<AlertSummaryResponseDto> {
  try {
    await validateAlertAccess(user, { targetCompanyId: user.usemid });

    const [totals, byType, byBranch] = await Promise.all([
      findAlertSummaryTotals(user.usemid),
      findAlertSummaryByType(user.usemid),
      findAlertSummaryByBranch(user.usemid),
    ]);

    return {
      totalVisible: totals.totalvisible,
      totalUnseen: totals.totalunseen,
      byType: byType.map((item) => ({
        type: item.type,
        totalVisible: item.totalvisible,
        totalUnseen: item.totalunseen,
      })),
      byBranch: byBranch.map((item) => ({
        suid: item.suid,
        sunombre: item.sunombre,
        suidentificador: item.suidentificador,
        totalVisible: item.totalvisible,
        totalUnseen: item.totalunseen,
      })),
    };
  } catch (error) {
    logger.error({ err: error, requesterCompanyId: user.usemid }, 'Error reading alert summary');
    throw error;
  }
}

async function subscribeToAlerts(user: LoginUserDto, res: Response): Promise<void> {
  await validateAlertAccess(user, { targetCompanyId: user.usemid });

  let lastPollUpdatedAt = new Date();
  let lastPollAlertId = SSE_CURSOR_INITIAL_ALERT_ID;
  let pollId: ReturnType<typeof setInterval> | null = null;

  createSSEConnection(res, () => {
    if (pollId) {
      clearInterval(pollId);
    }
  });

  pollId = setInterval(async () => {
    try {
      const alerts = await findRecentChangedAlerts(user.usemid, lastPollUpdatedAt, lastPollAlertId);

      for (const alert of alerts) {
        const alertResponse = mapAlertEventToResponse(alert);
        sendSSEData(res, alert.aleventtype, alertResponse);
      }

      if (alerts.length > 0) {
        const lastAlert = alerts[alerts.length - 1]!;
        lastPollUpdatedAt = lastAlert.alfchactualizacion;
        lastPollAlertId = lastAlert.alid;
      }
    } catch (error) {
      logger.error({ err: error, emid: user.usemid }, '[SSE] Error polling alerts');
    }
  }, SSE_POLL_INTERVAL_MS);
}

export { readAlertAsViewed, readAlertSummary, readAlerts, subscribeToAlerts };
