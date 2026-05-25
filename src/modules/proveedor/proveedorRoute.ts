import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  registerProveedor,
  searchProveedor,
  searchProveedores,
  updateProveedorData,
} from './proveedorController.js';

const proveedorRouter = Router();

proveedorRouter.post('/', authenticate, registerProveedor);
proveedorRouter.get('/', authenticate, searchProveedores);
proveedorRouter.get('/:id', authenticate, searchProveedor);
proveedorRouter.patch('/:id', authenticate, updateProveedorData);

export { proveedorRouter };
