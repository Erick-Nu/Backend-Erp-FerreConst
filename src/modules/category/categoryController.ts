import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateCategoryDto,
  FindCategoriesParamsDto,
  FindCategoryDto,
  UpdateCategoryDto,
} from './categoryDto.js';
import { createCategory, readCategories, readCategory, updateCategory } from './categoryService.js';
import { isValidStatus } from '../../utils/validation.js';

type UpdateCategoryRequestBody = Omit<UpdateCategoryDto, 'ctgriaid'>;

const registerCategory: RequestHandler = async (req, res, next) => {
  try {
    const { ctgriaemid, ctgnombre, ctgriadescripcion } = req.body;
    const category: CreateCategoryDto = {
      ctgriaemid,
      ctgnombre,
      ctgriadescripcion: ctgriadescripcion ?? null,
    };
    const user: LoginUserDto = req.auth!;

    const categoryDB = await createCategory(category, user);

    res.status(201).json(categoryDB);
  } catch (error) {
    next(error);
  }
};

const searchCategories: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'La busqueda debe ser un texto' });
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

    const params: FindCategoriesParamsDto = {
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
    const categoriesDB = await readCategories(params, user);

    res.status(200).json(categoriesDB);
  } catch (error) {
    next(error);
  }
};

const searchCategory: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de categoría es requerido' });
      return;
    }

    const category: FindCategoryDto = {
      ctgriaid: id,
    };
    const user: LoginUserDto = req.auth!;

    const categoryDB = await readCategory(category, user);
    if (!categoryDB) {
      res.status(404).json({ message: 'Categoria no encontrada' });
      return;
    }

    res.status(200).json(categoryDB);
  } catch (error) {
    next(error);
  }
};

const updateCategoryData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de categoría es requerido' });
      return;
    }

    const body: UpdateCategoryRequestBody = req.body;
    const { ctgnombre, ctgriadescripcion, ctgriaestado } = body;
    const category: UpdateCategoryDto = {
      ctgriaid: id,
    };

    if (ctgnombre !== undefined) {
      category.ctgnombre = ctgnombre;
    }

    if (ctgriadescripcion !== undefined) {
      category.ctgriadescripcion = ctgriadescripcion;
    }

    if (ctgriaestado !== undefined) {
      category.ctgriaestado = ctgriaestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedCategory = await updateCategory(category, user);
    if (!updatedCategory) {
      res.status(404).json({ message: 'Categoria no encontrada' });
      return;
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    next(error);
  }
};

export { registerCategory, searchCategories, searchCategory, updateCategoryData };
