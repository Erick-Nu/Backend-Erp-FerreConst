import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { parseImage } from '../../middlewares/uploadImage.js';
import {
  registerCompany,
  searchCompanies,
  searchCompany,
  updateCompanyData,
  updateCompanyStatus
} from './companyController.js';

const companyRouter = Router();

companyRouter.post('/', authenticate, parseImage, registerCompany);
companyRouter.get('/', authenticate, searchCompanies);
companyRouter.get('/:id', authenticate, searchCompany);
companyRouter.patch('/:id', authenticate, parseImage, updateCompanyData);
companyRouter.patch('/:id/status', authenticate, updateCompanyStatus);

export { companyRouter };
