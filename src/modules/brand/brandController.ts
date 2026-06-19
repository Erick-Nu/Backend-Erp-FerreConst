import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type { CreateBrandDto, FindBrandDto, FindBrandsParamsDto, UpdateBrandDto } from './brandDto.js';
import { createBrand, readBrand, readBrands, updateBrand } from './brandService.js';
import { isValidStatus } from '../../utils/validation.js';

type UpdateBrandRequestBody = Omit<UpdateBrandDto, 'mrcid'>;

const registerBrand: RequestHandler = async (req, res, next) => {
  try {
    const { mrcemid, mrcnombre } = req.body;
    const brand: CreateBrandDto = {
      mrcemid,
      mrcnombre,
    };
    const user: LoginUserDto = req.auth!;

    const brandDB = await createBrand(brand, user);

    res.status(201).json(brandDB);
  } catch (error) {
    next(error);
  }
};

const searchBrands: RequestHandler = async (req, res, next) => {
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

    const params: FindBrandsParamsDto = {
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
    const brandsDB = await readBrands(params, user);

    res.status(200).json(brandsDB);
  } catch (error) {
    next(error);
  }
};

const searchBrand: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de marca es requerido' });
      return;
    }

    const brand: FindBrandDto = {
      mrcid: id,
    };
    const user: LoginUserDto = req.auth!;

    const brandDB = await readBrand(brand, user);
    if (!brandDB) {
      res.status(404).json({ message: 'Marca no encontrada' });
      return;
    }

    res.status(200).json(brandDB);
  } catch (error) {
    next(error);
  }
};

const updateBrandData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de marca es requerido' });
      return;
    }

    const body: UpdateBrandRequestBody = req.body;
    const { mrcnombre, mrcestado } = body;
    const brand: UpdateBrandDto = {
      mrcid: id,
    };

    if (mrcnombre !== undefined) {
      brand.mrcnombre = mrcnombre;
    }

    if (mrcestado !== undefined) {
      brand.mrcestado = mrcestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedBrand = await updateBrand(brand, user);
    if (!updatedBrand) {
      res.status(404).json({ message: 'Marca no encontrada' });
      return;
    }

    res.status(200).json(updatedBrand);
  } catch (error) {
    next(error);
  }
};

export { registerBrand, searchBrands, searchBrand, updateBrandData };
