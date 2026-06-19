import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type { FindAlertsParamsDto } from './alertDto.js';
import { readAlertAsViewed, readAlertSummary, readAlerts, subscribeToAlerts } from './alertService.js';

const DEFAULT_ALERT_PAGE = 1;
const DEFAULT_ALERT_PAGE_SIZE = 20;

function parseOptionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

const searchAlerts: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const { suid, tipo } = req.query;
    const visible = parseOptionalBoolean(req.query.visible);
    const visto = parseOptionalBoolean(req.query.visto);

    if (visible === null) {
      res.status(400).json({ message: 'Visible must be true or false' });
      return;
    }

    if (visto === null) {
      res.status(400).json({ message: 'Viewed must be true or false' });
      return;
    }

    const user: LoginUserDto = req.auth!;

    const page = pageQuery === undefined ? DEFAULT_ALERT_PAGE : Number(pageQuery);
    const pageSize = pageSizeQuery === undefined ? DEFAULT_ALERT_PAGE_SIZE : Number(pageSizeQuery);

    const params: FindAlertsParamsDto = {
      page,
      pageSize,
    };

    if (typeof suid === 'string' && suid.trim().length > 0) {
      params.suid = suid.trim();
    }

    if (typeof tipo === 'string' && tipo.trim().length > 0) {
      params.tipo = tipo.trim();
    }

    if (visible !== undefined) {
      params.visible = visible;
    }

    if (visto !== undefined) {
      params.visto = visto;
    }

    const alertsDB = await readAlerts(params, user);

    res.status(200).json(alertsDB);
  } catch (error) {
    next(error);
  }
};

const searchAlertSummary: RequestHandler = async (req, res, next) => {
  try {
    const user: LoginUserDto = req.auth!;
    const summaryDB = await readAlertSummary(user);

    res.status(200).json(summaryDB);
  } catch (error) {
    next(error);
  }
};

const updateAlertAsViewed: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Alert id is required' });
      return;
    }

    const user: LoginUserDto = req.auth!;

    await readAlertAsViewed(id, user);

    res.status(200).json({ message: 'Alert marked as viewed' });
  } catch (error) {
    next(error);
  }
};

const subscribeAlertEvents: RequestHandler = async (req, res, next) => {
  try {
    const user: LoginUserDto = req.auth!;
    await subscribeToAlerts(user, res);
  } catch (error) {
    next(error);
  }
};

export { searchAlertSummary, searchAlerts, updateAlertAsViewed, subscribeAlertEvents };
