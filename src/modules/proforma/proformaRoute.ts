import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  cancelProformaData,
  payProformaData,
  registerProforma,
  replaceProformaData,
  searchProforma,
  searchProformaPdf,
  searchProformas,
} from './proformaController.js';

const proformaRouter = Router();

proformaRouter.post('/', authenticate, registerProforma);
proformaRouter.get('/', authenticate, searchProformas);
proformaRouter.get('/:id/pdf', authenticate, searchProformaPdf);
proformaRouter.get('/:id', authenticate, searchProforma);
proformaRouter.put('/:id', authenticate, replaceProformaData);
proformaRouter.patch('/:id/pay', authenticate, payProformaData);
proformaRouter.patch('/:id/cancel', authenticate, cancelProformaData);

export { proformaRouter };
