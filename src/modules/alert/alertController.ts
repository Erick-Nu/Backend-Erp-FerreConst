import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type { FindAlertsParamsDto } from './alertDto.js';
import { readAlertAsViewed, readAlerts, subscribeToAlerts } from './alertService.js';

const searchAlerts: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const { suid } = req.query;
    const user: LoginUserDto = req.auth!;

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindAlertsParamsDto = {
      page,
      pageSize,
    };

    if (typeof suid === 'string' && suid.trim().length > 0) {
      params.suid = suid.trim();
    }

    const alertsDB = await readAlerts(params, user);

    res.status(200).json(alertsDB);
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

export { searchAlerts, updateAlertAsViewed, subscribeAlertEvents };
