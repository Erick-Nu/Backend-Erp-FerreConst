import type { Response } from 'express';
import { logger } from '../../utils/logger.js';
import { validateRequiredString } from '../../utils/validation.js';
import { findCompanyById } from '../company/companyDao.js';
import { findBranchById } from '../branch/branchDao.js';
import { findUserById } from '../user/userDao.js';
import type { LoginUserDto } from '../auth/authDto.js';
import { createSSEConnection, sendSSEData } from '../../services/sseManager.js';
import {
  countAlertsByCompany,
  countAlertsByCompanyAndBranch,
  findAlertsByCompany,
  findAlertsByCompanyAndBranch,
  findRecentUnseenAlerts,
  markAlertAsViewed,
} from './alertDao.js';
import type { AlertResponseDto, FindAlertsParamsDto, FindAlertsResponseDto } from './alertDto.js';

const SSE_POLL_INTERVAL_MS = 5000;
const EMPTY_ALERT_ID_MESSAGE = 'Alert id is required';
const INVALID_COMPANY_FIND_MESSAGE = 'Company does not exist';
const INVALID_COMPANY_STATUS_MESSAGE = 'Company is not active';
const INVALID_USER_NOT_FOUND_MESSAGE = 'User does not exist';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'User does not belong to the company';
const INVALID_USER_STATUS_MESSAGE = 'User is not active';
const FORBIDDEN_ROL_USER_MESSAGE = 'User is not jefe, empleado or admin';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'User cannot access another company';
const INVALID_PAGE_MESSAGE = 'Page must be a positive integer';
const INVALID_PAGE_SIZE_MESSAGE = 'Page size must be a positive integer';
const INVALID_BRANCH_NOT_FOUND_MESSAGE = 'Branch does not exist';
const ALERT_NOT_FOUND_MESSAGE = 'Alert not found';

type AccessOptions = {
  targetCompanyId: string;
};

import type { AlertRowWithJoinsDao } from './alertDao.js';

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
  };
}

async function validateAlertAccess(user: LoginUserDto, options: AccessOptions): Promise<void> {
  const { targetCompanyId } = options;

  const company = await findCompanyById(user.usemid);
  if (!company) {
    throw new Error(INVALID_COMPANY_FIND_MESSAGE);
  }

  if (company.emestado !== 'activo') {
    throw new Error(INVALID_COMPANY_STATUS_MESSAGE);
  }

  const userCompany = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!userCompany) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  if (userCompany.usemid !== user.usemid) {
    throw new Error(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE);
  }

  if (targetCompanyId !== user.usemid) {
    throw new Error(FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE);
  }

  if (!['jefe', 'empleado', 'administrador'].includes(userCompany.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_MESSAGE);
  }

  if (userCompany.usestado !== 'activo') {
    throw new Error(INVALID_USER_STATUS_MESSAGE);
  }
}

async function readAlerts(
  params: FindAlertsParamsDto,
  user: LoginUserDto,
): Promise<FindAlertsResponseDto> {
  const { suid, page, pageSize } = params;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(INVALID_PAGE_MESSAGE);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(INVALID_PAGE_SIZE_MESSAGE);
  }

  try {
    await validateAlertAccess(user, { targetCompanyId: user.usemid });

    const offset = (page - 1) * pageSize;

    if (suid) {
      const branch = await findBranchById({ suid, suemid: user.usemid });
      if (!branch) {
        throw new Error(INVALID_BRANCH_NOT_FOUND_MESSAGE);
      }

      const [items, totalItems] = await Promise.all([
        findAlertsByCompanyAndBranch(user.usemid, suid, pageSize, offset),
        countAlertsByCompanyAndBranch(user.usemid, suid),
      ]);

      return {
        items: items.map(mapAlertRowToResponse),
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    }

    const [items, totalItems] = await Promise.all([
      findAlertsByCompany(user.usemid, pageSize, offset),
      countAlertsByCompany(user.usemid),
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
  const validatedId = validateRequiredString(alid, EMPTY_ALERT_ID_MESSAGE);

  try {
    await validateAlertAccess(user, { targetCompanyId: user.usemid });

    const updated = await markAlertAsViewed(validatedId, user.usemid);

    if (!updated) {
      throw new Error(ALERT_NOT_FOUND_MESSAGE);
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

async function subscribeToAlerts(user: LoginUserDto, res: Response): Promise<void> {
  await validateAlertAccess(user, { targetCompanyId: user.usemid });

  let lastPoll = new Date();
  let pollId: ReturnType<typeof setInterval> | null = null;

  createSSEConnection(res, () => {
    if (pollId) {
      clearInterval(pollId);
    }
  });

  pollId = setInterval(async () => {
    try {
      const alerts = await findRecentUnseenAlerts(user.usemid, lastPoll);

      for (const alert of alerts) {
        sendSSEData(res, 'new-alert', mapAlertRowToResponse(alert));
      }

      if (alerts.length > 0) {
        lastPoll = new Date();
      }
    } catch (error) {
      logger.error({ err: error, emid: user.usemid }, '[SSE] Error polling alerts');
    }
  }, SSE_POLL_INTERVAL_MS);
}

export { readAlertAsViewed, readAlerts, subscribeToAlerts };
