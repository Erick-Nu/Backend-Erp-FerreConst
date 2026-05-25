import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { registerCheckout, searchCheckout, searchCheckouts, updateCheckoutStatus } from './checkoutController.js';

const checkoutRouter = Router();

checkoutRouter.post('/', authenticate, registerCheckout);
checkoutRouter.get('/', authenticate, searchCheckouts);
checkoutRouter.get('/:id', authenticate, searchCheckout);
checkoutRouter.patch('/:id/status', authenticate, updateCheckoutStatus);

export { checkoutRouter };
