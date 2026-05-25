import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { registerBrand, searchBrand, searchBrands, updateBrandData } from './brandController.js';

const brandRouter = Router();

brandRouter.post('/', authenticate, registerBrand);
brandRouter.get('/', authenticate, searchBrands);
brandRouter.get('/:id', authenticate, searchBrand);
brandRouter.patch('/:id', authenticate, updateBrandData);

export { brandRouter };
