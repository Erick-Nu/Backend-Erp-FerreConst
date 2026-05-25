import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  registerMedida,
  searchMedida,
  searchMedidas,
  updateMedidaData,
} from './medidaController.js';

const medidaRouter = Router();

medidaRouter.post('/', authenticate, registerMedida);
medidaRouter.get('/', authenticate, searchMedidas);
medidaRouter.get('/:id', authenticate, searchMedida);
medidaRouter.patch('/:id', authenticate, updateMedidaData);

export { medidaRouter };
