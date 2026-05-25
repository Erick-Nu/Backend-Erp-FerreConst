import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  registerClient,
  searchClient,
  searchClients,
  updateClientData,
} from './clientController.js';

const clientRouter = Router();

clientRouter.post('/', authenticate, registerClient);
clientRouter.get('/', authenticate, searchClients);
clientRouter.get('/:id', authenticate, searchClient);
clientRouter.patch('/:id', authenticate, updateClientData);

export { clientRouter };
