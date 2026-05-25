import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { registerCategory, searchCategories, searchCategory, updateCategoryData } from './categoryController.js';

const categoryRouter = Router();

categoryRouter.post('/', authenticate, registerCategory);
categoryRouter.get('/', authenticate, searchCategories);
categoryRouter.get('/:id', authenticate, searchCategory);
categoryRouter.patch('/:id', authenticate, updateCategoryData);

export { categoryRouter };
