import type { LoginUserDto } from '../auth/authDto.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import { validateRequiredString, validateStatus } from '../../utils/validation.js';
import type {
  BrandResponseDto,
  CreateBrandDto,
  FindBrandDto,
  FindBrandsParamsDto,
  FindBrandsResponseDto,
  UpdateBrandDto,
} from './brandDto.js';
import { findBrandById, findBrandByName, findBrands, saveBrand, updateBrandById } from './brandDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_BRAND_NAME_MESSAGE = 'El nombre de marca es requerido';
const EMPTY_BRAND_ID_MESSAGE = 'El id de marca es requerido';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no esta activo';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE = 'El usuario no es jefe o empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es empresa padre';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const INVALID_PAGE_MESSAGE = 'La pagina debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamano de pagina debe ser un entero positivo';
const INVALID_BRAND_EXISTS_MESSAGE = 'Ya existe una marca con ese nombre';
const EMPTY_BRAND_STATUS_MESSAGE = 'El estado de marca es requerido';
const INVALID_BRAND_UPDATE_STATUS_MESSAGE = 'El estado de marca debe ser activo, inactivo o eliminado';
const EMPTY_UPDATE_BRAND_MESSAGE = 'Al menos un campo es requerido para actualizar la marca';
const FORBIDDEN_UPDATE_DELETED_BRAND_MESSAGE = 'La marca eliminada no puede ser actualizada';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateFindBrandsParams(params: FindBrandsParamsDto): FindBrandsParamsDto {
  const { page, pageSize, search, status } = params;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(INVALID_PAGE_MESSAGE);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(INVALID_PAGE_SIZE_MESSAGE);
  }

  const normalizedSearch = typeof search === 'string'
    ? search.trim()
    : undefined;

  const validatedParams: FindBrandsParamsDto = {
    page,
    pageSize,
  };

  if (normalizedSearch && normalizedSearch.length > 0) {
    validatedParams.search = normalizedSearch;
  }

  if (status) {
    validatedParams.status = status;
  }

  return validatedParams;
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

async function createBrand(brand: CreateBrandDto, user: LoginUserDto): Promise<BrandResponseDto> {
  const mrcemid = validateRequiredString(brand.mrcemid, EMPTY_COMPANY_ID_MESSAGE);
  const mrcnombre = validateRequiredString(brand.mrcnombre, EMPTY_BRAND_NAME_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: mrcemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const brandByNameDB = await findBrandByName({
      mrcemid,
      mrcnombre,
    });

    if (brandByNameDB) {
      throw new Error(INVALID_BRAND_EXISTS_MESSAGE);
    }

    const brandId = await saveBrand({
      mrcemid,
      mrcnombre,
    });

    const newBrand = await findBrandById({
      mrcemid,
      mrcid: brandId,
    });

    return newBrand!;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: mrcemid,
        brandName: mrcnombre,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating brand',
    );
    throw error;
  }
}

async function readBrand(brand: FindBrandDto, user: LoginUserDto): Promise<BrandResponseDto | null> {
  const mrcid = validateRequiredString(brand.mrcid, EMPTY_BRAND_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const brandDB = await findBrandById({
      mrcemid: user.usemid,
      mrcid,
    });

    if (!brandDB) {
      throw new Error('Marca no encontrada');
    }

    return brandDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        brandId: mrcid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading brand',
    );
    throw error;
  }
}

async function readBrands(
  params: FindBrandsParamsDto,
  user: LoginUserDto,
): Promise<FindBrandsResponseDto> {
  const validatedParams = validateFindBrandsParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const brandsDB = await findBrands(validatedParams, user.usemid);

    return brandsDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading brands',
    );
    throw error;
  }
}

async function updateBrand(brand: UpdateBrandDto, user: LoginUserDto): Promise<BrandResponseDto | null> {
  const mrcid = validateRequiredString(brand.mrcid, EMPTY_BRAND_ID_MESSAGE);
  const mrcnombre = brand.mrcnombre !== undefined
    ? validateRequiredString(brand.mrcnombre, EMPTY_BRAND_NAME_MESSAGE)
    : undefined;
  const mrcestado = brand.mrcestado !== undefined
    ? validateStatus(brand.mrcestado, EMPTY_BRAND_STATUS_MESSAGE, INVALID_BRAND_UPDATE_STATUS_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const brandDB = await findBrandById({
      mrcemid: user.usemid,
      mrcid,
    });

    if (!brandDB) {
      return null;
    }

    if (brandDB.mrcestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_BRAND_MESSAGE);
    }

    if (mrcnombre !== undefined) {
      const brandByNameDB = await findBrandByName({
        mrcemid: user.usemid,
        mrcnombre,
      });

      if (brandByNameDB && brandByNameDB.mrcid !== mrcid) {
        throw new Error(INVALID_BRAND_EXISTS_MESSAGE);
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    if (mrcnombre !== undefined && mrcnombre !== brandDB.mrcnombre) {
      dataDB.push({ column: 'mrcnombre', value: mrcnombre });
    }

    if (mrcestado !== undefined && mrcestado !== brandDB.mrcestado) {
      dataDB.push({ column: 'mrcestado', value: mrcestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_BRAND_MESSAGE);
    }

    const updatedBrandDB = await updateBrandById(dataDB, {
      mrcemid: user.usemid,
      mrcid,
    });

    if (!updatedBrandDB) {
      return null;
    }

    return updatedBrandDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        brandId: mrcid,
        hasName: mrcnombre !== undefined,
        hasStatus: mrcestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating brand',
    );
    throw error;
  }
}

export { createBrand, readBrand, readBrands, updateBrand };
