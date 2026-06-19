import type { RequestHandler } from 'express';
import {
  getImage,
  saveImage,
  validateImageSize,
  validateImageType,
} from '../../middlewares/uploadImage.js';
import type { LoginUserDto } from '../auth/authDto.js';
import type { CreateCompanyDto, FindCompaniesParamsDto, UpdateCompanyDto } from './companyDto.js';
import { createCompany, readCompanies, readCompany, updateCompany, updateCompanyWithStatus } from './companyService.js';
import { isValidStatus } from '../../utils/validation.js';

const COMPANY_IMAGE_BASE_PATH = '/empresas';
const DEFAULT_COMPANY_IMAGE_PUBLIC_PATH = '/uploads/empresas/company.png';
type UpdateCompanyRequestBody = Omit<UpdateCompanyDto, 'emid' | 'emlogo'>;

const registerCompany: RequestHandler = async (req, res, next) => {
  let logoDB: string;
  try {
    const image = getImage(req);
    if (!image) {
      logoDB = DEFAULT_COMPANY_IMAGE_PUBLIC_PATH;
    } else {
      validateImageSize(image);
      validateImageType(image);
      logoDB = await saveImage(image, COMPANY_IMAGE_BASE_PATH);
    }

    const { emruc, emrznsocial, emcorreo, emcodigo } = req.body;
    const company: CreateCompanyDto = {
      emruc,
      emrznsocial,
      emcorreo,
      emlogo: logoDB,
      emcodigo,
    };
    const user: LoginUserDto = req.auth!;

    const companyDB = await createCompany(company, user);

    res.status(201).json(companyDB);
    
  } catch (error) {
    next(error);
  }
};

const searchCompanies: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'La búsqueda debe ser un texto' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser un texto' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidStatus(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser activo o inactivo' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindCompaniesParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const user: LoginUserDto = req.auth!;
    const companiesDB = await readCompanies(params, user);

    res.status(200).json(companiesDB);
  } catch (error) {
    next(error);
  }
};

const searchCompany: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de empresa es requerido' });
      return;
    }

    const user: LoginUserDto = req.auth!;
    const company = {
      emid: id,
    };

    const companyDB = await readCompany(company, user);

    if (!companyDB) {
      res.status(404).json({ message: 'Empresa no encontrada' });
      return;
    }

    res.status(200).json(companyDB);
  } catch (error) {
    next(error);
  }
};

const updateCompanyStatus: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { emestado } = req.body;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de empresa es requerido' });
      return;
    }

    const company = {
      emid: id,
      emestado,
    };

    const user: LoginUserDto = req.auth!;

    const updated = await updateCompanyWithStatus(company, user);

    if (!updated) {
      res.status(404).json({ message: 'Empresa no encontrada' });
      return;
    }

    res.status(200).json({ message: 'Estado de empresa actualizado' });
  } catch (error) {
    next(error);
  }
}

const updateCompanyData: RequestHandler = async (req, res, next) => {
  let logoDB: string | undefined;
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de empresa es requerido' });
      return;
    }

    const image = getImage(req);
    if (image) {
      validateImageSize(image);
      validateImageType(image);
      logoDB = await saveImage(image, COMPANY_IMAGE_BASE_PATH);
    }

    const body: UpdateCompanyRequestBody = req.body;
    const { emrznsocial, emcorreo } = body;
    const company: UpdateCompanyDto = { emid: id };

    if (emrznsocial !== undefined) {
      company.emrznsocial = emrznsocial;
    }

    if (emcorreo !== undefined) {
      company.emcorreo = emcorreo;
    }

    if (logoDB !== undefined) {
      company.emlogo = logoDB;
    }

    const user: LoginUserDto = req.auth!;
    const updatedCompany = await updateCompany(company, user);

    if (!updatedCompany) {
      res.status(404).json({ message: 'Empresa no encontrada' });
      return;
    }

    res.status(200).json(updatedCompany);
  } catch (error) {
    next(error);
  }
};

export { registerCompany, searchCompanies, searchCompany, updateCompanyStatus, updateCompanyData };
