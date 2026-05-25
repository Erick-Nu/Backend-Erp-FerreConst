import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  registerStock,
  searchStock,
  searchStocks,
  searchStocksByCompany,
  updateStockData,
} from './stockController.js';

const stockRouter = Router();

stockRouter.post('/', authenticate, registerStock);
stockRouter.get('/', authenticate, searchStocks);
stockRouter.get('/all', authenticate, searchStocksByCompany);
stockRouter.get('/:id', authenticate, searchStock);
stockRouter.patch('/:id', authenticate, updateStockData);

export { stockRouter };
