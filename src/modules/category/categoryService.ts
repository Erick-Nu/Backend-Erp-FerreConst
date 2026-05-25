import type { LoginUserDto } from '../auth/authDto.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import { validateRequiredString, validateStatus } from '../../utils/validation.js';
import type {
  CategoryResponseDto,
  CreateCategoryDto,
  FindCategoriesParamsDto,
  FindCategoriesResponseDto,
  FindCategoryDto,
  UpdateCategoryDto,
} from './categoryDto.js';
import {
  findCategories,
  findCategoryById,
  findCategoryByName,
  saveCategory,
  updateCategoryById,
} from './categoryDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'Company id is required';
const EMPTY_CATEGORY_NAME_MESSAGE = 'Category name is required';
const EMPTY_CATEGORY_ID_MESSAGE = 'Category id is required';
const INVALID_COMPANY_FIND_MESSAGE = 'Company does not exist';
const INVALID_COMPANY_STATUS_MESSAGE = 'Company is not active';
const INVALID_USER_NOT_FOUND_MESSAGE = 'User does not exist';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'User does not belong to the company';
const INVALID_USER_STATUS_MESSAGE = 'User is not active';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'User is not admin';
const FORBIDDEN_ROL_USER_MESSAGE = 'User is not jefe, empleado or admin';
const FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE = 'User is not jefe or empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'Company is not parent';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'User cannot access another company';
const INVALID_PAGE_MESSAGE = 'Page must be a positive integer';
const INVALID_PAGE_SIZE_MESSAGE = 'Page size must be a positive integer';
const INVALID_CATEGORY_EXISTS_MESSAGE = 'Category already exists with that name';
const EMPTY_CATEGORY_STATUS_MESSAGE = 'Category status is required';
const INVALID_CATEGORY_UPDATE_STATUS_MESSAGE = 'Category status must be activo, inactivo or eliminado';
const EMPTY_CATEGORY_DESCRIPTION_MESSAGE = 'Category description is required';
const EMPTY_UPDATE_CATEGORY_MESSAGE = 'At least one field is required to update category';
const FORBIDDEN_UPDATE_DELETED_CATEGORY_MESSAGE = 'Deleted category cannot be updated';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateFindCategoriesParams(params: FindCategoriesParamsDto): FindCategoriesParamsDto {
  const { page, pageSize } = params;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(INVALID_PAGE_MESSAGE);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(INVALID_PAGE_SIZE_MESSAGE);
  }

  return {
    page,
    pageSize,
  };
}

async function validateCompanyAndUserAccess(user: LoginUserDto, options: AccessOptions): Promise<void> {
  const { requireParentCompany, requireAdminUser, targetCompanyId } = options;

  const companyDB = await findCompanyById(user.usemid);
  if (!companyDB) {
    throw new Error(INVALID_COMPANY_FIND_MESSAGE);
  }

  const isActiveCompany = companyDB.emestado;
  if (isActiveCompany !== 'activo') {
    throw new Error(INVALID_COMPANY_STATUS_MESSAGE);
  }

  const userDB = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!userDB) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  const isUserCompany = userDB.usemid;
  if (isUserCompany !== user.usemid) {
    throw new Error(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE);
  }

  if (targetCompanyId && targetCompanyId !== user.usemid) {
    throw new Error(FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE);
  }

  if (requireAdminUser && userDB.usrol !== 'administrador') {
    throw new Error(FORBIDDEN_ROL_USER_ADMIN_MESSAGE);
  }

  if (!requireAdminUser && !['jefe', 'empleado', 'administrador'].includes(userDB.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_MESSAGE);
  }

  const isActiveUser = userDB.usestado;
  if (isActiveUser !== 'activo') {
    throw new Error(INVALID_USER_STATUS_MESSAGE);
  }

  if (requireParentCompany && !companyDB.empadre) {
    throw new Error(FORBIDDEN_COMPANY_CREATION_MESSAGE);
  }
}

async function validateRequesterJefeOrEmpleado(user: LoginUserDto): Promise<void> {
  const requesterUser = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!requesterUser) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  if (!['jefe', 'empleado'].includes(requesterUser.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE);
  }
}

async function createCategory(category: CreateCategoryDto, user: LoginUserDto): Promise<CategoryResponseDto> {
  const ctgriaemid = validateRequiredString(category.ctgriaemid, EMPTY_COMPANY_ID_MESSAGE);
  const ctgnombre = validateRequiredString(category.ctgnombre, EMPTY_CATEGORY_NAME_MESSAGE);
  const ctgriadescripcion = category.ctgriadescripcion ?? null;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: ctgriaemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const categoryByNameDB = await findCategoryByName({
      ctgriaemid,
      ctgnombre,
    });

    if (categoryByNameDB) {
      throw new Error(INVALID_CATEGORY_EXISTS_MESSAGE);
    }

    const categoryId = await saveCategory({
      ctgriaemid,
      ctgnombre,
      ctgriadescripcion,
    });

    const newCategory = await findCategoryById({
      ctgriaemid,
      ctgriaid: categoryId,
    });

    return newCategory!;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: ctgriaemid,
        categoryName: ctgnombre,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating category',
    );
    throw error;
  }
}

async function readCategory(category: FindCategoryDto, user: LoginUserDto): Promise<CategoryResponseDto | null> {
  const ctgriaid = validateRequiredString(category.ctgriaid, EMPTY_CATEGORY_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const categoryDB = await findCategoryById({
      ctgriaemid: user.usemid,
      ctgriaid,
    });

    if (!categoryDB) {
      throw new Error('Category not found');
    }

    return categoryDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        categoryId: ctgriaid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading category',
    );
    throw error;
  }
}

async function readCategories(
  params: FindCategoriesParamsDto,
  user: LoginUserDto,
): Promise<FindCategoriesResponseDto> {
  const validatedParams = validateFindCategoriesParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const categoriesDB = await findCategories(validatedParams, user.usemid);

    return categoriesDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading categories',
    );
    throw error;
  }
}

async function updateCategory(category: UpdateCategoryDto, user: LoginUserDto): Promise<CategoryResponseDto | null> {
  const ctgriaid = validateRequiredString(category.ctgriaid, EMPTY_CATEGORY_ID_MESSAGE);
  const ctgnombre = category.ctgnombre !== undefined
    ? validateRequiredString(category.ctgnombre, EMPTY_CATEGORY_NAME_MESSAGE)
    : undefined;
  const ctgriadescripcion = category.ctgriadescripcion !== undefined
    ? (category.ctgriadescripcion === null
      ? null
      : validateRequiredString(category.ctgriadescripcion, EMPTY_CATEGORY_DESCRIPTION_MESSAGE))
    : undefined;
  const ctgriaestado = category.ctgriaestado !== undefined
    ? validateStatus(
      category.ctgriaestado,
      EMPTY_CATEGORY_STATUS_MESSAGE,
      INVALID_CATEGORY_UPDATE_STATUS_MESSAGE,
    )
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const categoryDB = await findCategoryById({
      ctgriaemid: user.usemid,
      ctgriaid,
    });

    if (!categoryDB) {
      return null;
    }

    if (categoryDB.ctgriaestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_CATEGORY_MESSAGE);
    }

    if (ctgnombre !== undefined) {
      const categoryByNameDB = await findCategoryByName({
        ctgriaemid: user.usemid,
        ctgnombre,
      });

      if (categoryByNameDB && categoryByNameDB.ctgriaid !== ctgriaid) {
        throw new Error(INVALID_CATEGORY_EXISTS_MESSAGE);
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    if (ctgnombre !== undefined && ctgnombre !== categoryDB.ctgnombre) {
      dataDB.push({ column: 'ctgnombre', value: ctgnombre });
    }

    if (ctgriadescripcion !== undefined && ctgriadescripcion !== categoryDB.ctgriadescripcion) {
      dataDB.push({ column: 'ctgriadescripcion', value: ctgriadescripcion });
    }

    if (ctgriaestado !== undefined && ctgriaestado !== categoryDB.ctgriaestado) {
      dataDB.push({ column: 'ctgriaestado', value: ctgriaestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_CATEGORY_MESSAGE);
    }

    const updatedCategoryDB = await updateCategoryById(dataDB, {
      ctgriaemid: user.usemid,
      ctgriaid,
    });

    if (!updatedCategoryDB) {
      return null;
    }

    return updatedCategoryDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        categoryId: ctgriaid,
        hasName: ctgnombre !== undefined,
        hasDescription: ctgriadescripcion !== undefined,
        hasStatus: ctgriaestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating category',
    );
    throw error;
  }
}

export { createCategory, readCategory, readCategories, updateCategory };
