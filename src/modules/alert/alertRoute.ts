import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  searchAlertSummary,
  searchAlerts,
  subscribeAlertEvents,
  updateAlertAsViewed,
} from './alertController.js';

const alertRouter = Router();

alertRouter.get('/', authenticate, searchAlerts);
alertRouter.get('/events', authenticate, subscribeAlertEvents);
alertRouter.get('/summary', authenticate, searchAlertSummary);
alertRouter.patch('/:id/visto', authenticate, updateAlertAsViewed);

export { alertRouter };
