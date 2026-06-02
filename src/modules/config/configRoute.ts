import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  deleteConfigData,
  registerConfig,
  searchConfig,
  searchConfigs,
  updateConfigData,
} from './configController.js';

const configRouter = Router();

configRouter.post('/', authenticate, registerConfig);
configRouter.get('/', authenticate, searchConfigs);
configRouter.get('/:configKey', authenticate, searchConfig);
configRouter.patch('/:configKey', authenticate, updateConfigData);
configRouter.delete('/:configKey', authenticate, deleteConfigData);

export { configRouter };
