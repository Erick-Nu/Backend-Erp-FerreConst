import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  registerPlaymentMethod,
  searchPlaymentMethod,
  searchPlaymentMethods,
  updatePlaymentMethodData,
} from './playmentMethodController.js';

const playmentMethodRouter = Router();

playmentMethodRouter.post('/', authenticate, registerPlaymentMethod);
playmentMethodRouter.get('/', authenticate, searchPlaymentMethods);
playmentMethodRouter.get('/:id', authenticate, searchPlaymentMethod);
playmentMethodRouter.patch('/:id', authenticate, updatePlaymentMethodData);

export { playmentMethodRouter };
