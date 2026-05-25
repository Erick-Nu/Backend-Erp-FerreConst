import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { parseImage } from '../../middlewares/uploadImage.js';
import {
  registerProduct,
  searchProduct,
  searchProducts,
  updateProductData,
} from './productController.js';

const productRouter = Router();

productRouter.post('/', authenticate, parseImage, registerProduct);
productRouter.get('/', authenticate, searchProducts);
productRouter.get('/:id', authenticate, searchProduct);
productRouter.patch('/:id', authenticate, parseImage, updateProductData);

export { productRouter };
