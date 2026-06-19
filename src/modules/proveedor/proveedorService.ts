import type { LoginUserDto } from '../auth/authDto.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { findCategoryById } from '../category/categoryDao.js';
import { findBrandById } from '../brand/brandDao.js';
import { logger } from '../../utils/logger.js';
import { validateEmail, validateRequiredString, validateStatus, validatePhone } from '../../utils/validation.js';
import type {
  CreateProveedorDto,
  FindProveedorDto,
  FindProveedoresParamsDto,
  FindProveedoresResponseDto,
  ProveedorResponseDto,
  UpdateProveedorDto,
} from './proveedorDto.js';
import {
  findProveedorById,
  findProveedorByName,
  findProveedores,
  saveProveedor,
  updateProveedorById,
} from './proveedorDao.js';
import type { FindProveedoresResponseDao, ProveedorRowDao } from './proveedorDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'Company id is required';
const EMPTY_PROVEEDOR_ID_MESSAGE = 'Proveedor id is required';
const EMPTY_PROVEEDOR_NAME_MESSAGE = 'Proveedor name is required';
const EMPTY_PROVEEDOR_PHONE_MESSAGE = 'Proveedor phone is required';
const EMPTY_PROVEEDOR_EMAIL_MESSAGE = 'Proveedor email is required';
const EMPTY_PROVEEDOR_CATEGORY_ID_MESSAGE = 'Proveedor category id is required';
const EMPTY_PROVEEDOR_BRAND_ID_MESSAGE = 'Proveedor brand id is required';
const EMPTY_PROVEEDOR_STATUS_MESSAGE = 'Proveedor status is required';
const INVALID_PROVEEDOR_EMAIL_MESSAGE = 'Proveedor email must be valid';
const INVALID_PROVEEDOR_UPDATE_STATUS_MESSAGE = 'Proveedor status must be activo, inactivo or eliminado';
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
const INVALID_PROVEEDOR_PHONE_MESSAGE = 'Proveedor phone must be valid';
const INVALID_PROVEEDOR_EXISTS_MESSAGE = 'Proveedor already exists with that name';
const EMPTY_UPDATE_PROVEEDOR_MESSAGE = 'At least one field is required to update proveedor';
const FORBIDDEN_UPDATE_DELETED_PROVEEDOR_MESSAGE = 'Deleted proveedor cannot be updated';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function mapProveedorRowToResponse(proveedor: ProveedorRowDao): ProveedorResponseDto {
  return {
    provid: proveedor.provid,
    provemid: proveedor.provemid,
    categoria: proveedor.provctgriaid
      ? { ctgriaid: proveedor.provctgriaid, ctgnombre: proveedor.ctgnombre ?? null, ctgriadescripcion: proveedor.ctgriadescripcion ?? null }
      : null,
    marca: proveedor.provmrcid
      ? { mrcid: proveedor.provmrcid, mrcnombre: proveedor.mrcnombre ?? null }
      : null,
    provnombre: proveedor.provnombre,
    provtelefono: proveedor.provtelefono,
    provcorreo: proveedor.provcorreo,
    provfchregistro: proveedor.provfchregistro,
    provestado: proveedor.provestado,
  };
}

function mapFindProveedoresResponse(proveedoresDB: FindProveedoresResponseDao): FindProveedoresResponseDto {
  return {
    ...proveedoresDB,
    items: proveedoresDB.items.map(mapProveedorRowToResponse),
  };
}

function validateFindProveedoresParams(params: FindProveedoresParamsDto): FindProveedoresParamsDto {
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

  const validatedParams: FindProveedoresParamsDto = {
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

async function createProveedor(proveedor: CreateProveedorDto, user: LoginUserDto): Promise<ProveedorResponseDto> {
  const provemid = validateRequiredString(proveedor.provemid, EMPTY_COMPANY_ID_MESSAGE);
  const provnombre = validateRequiredString(proveedor.provnombre, EMPTY_PROVEEDOR_NAME_MESSAGE);
  const provtelefono = validatePhone(proveedor.provtelefono, EMPTY_PROVEEDOR_PHONE_MESSAGE, INVALID_PROVEEDOR_PHONE_MESSAGE);
  const provctgriaid = proveedor.provctgriaid === null
    ? null
    : (proveedor.provctgriaid !== undefined
      ? validateRequiredString(proveedor.provctgriaid, EMPTY_PROVEEDOR_CATEGORY_ID_MESSAGE)
      : null);
  const provmrcid = proveedor.provmrcid === null
    ? null
    : (proveedor.provmrcid !== undefined
      ? validateRequiredString(proveedor.provmrcid, EMPTY_PROVEEDOR_BRAND_ID_MESSAGE)
      : null);
  const provcorreo = proveedor.provcorreo === null
    ? null
    : (proveedor.provcorreo !== undefined
      ? validateEmail(proveedor.provcorreo, EMPTY_PROVEEDOR_EMAIL_MESSAGE, INVALID_PROVEEDOR_EMAIL_MESSAGE)
      : null);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: provemid,
    };

    await validateCompanyAndUserAccess(user, access);

    await validateRequesterJefeOrEmpleado(user);

    const proveedorByNameDB = await findProveedorByName({provemid, provnombre});

    if (proveedorByNameDB) {
      throw new Error(INVALID_PROVEEDOR_EXISTS_MESSAGE);
    }

    if (provctgriaid) {
      const categoryProv = {
        ctgriaemid: provemid,
        ctgriaid: provctgriaid,
      }

      const categoryDB = await findCategoryById(categoryProv);

      if (!categoryDB) {
        throw new Error('Proveedor category does not exist');
      }

      if ([ 'inactivo', 'eliminado' ].includes(categoryDB.ctgriaestado)) {
        throw new Error('Proveedor category is not active');
      }
    }

    if (provmrcid) {
      const brandProv = {
        mrcemid: provemid,
        mrcid: provmrcid,
      }

      const brandDB = await findBrandById(brandProv);

      if (!brandDB) {
        throw new Error('Proveedor brand does not exist');
      }

      if ([ 'inactivo', 'eliminado' ].includes(brandDB.mrcestado)) {
        throw new Error('Proveedor brand is not active');
      }
    }

    const proveedorId = await saveProveedor({
      provemid,
      provctgriaid,
      provmrcid,
      provnombre,
      provtelefono,
      provcorreo,
    });

    const proveedorDB = await findProveedorById({provemid, provid: proveedorId });

    if (!proveedorDB) {
      throw new Error('Proveedor was not created');
    }

    return mapProveedorRowToResponse(proveedorDB);

  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: provemid,
        proveedorName: provnombre,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating proveedor',
    );
    throw error;
  }
}

async function readProveedor(proveedor: FindProveedorDto, user: LoginUserDto): Promise<ProveedorResponseDto | null> {
  const provid = validateRequiredString(proveedor.provid, EMPTY_PROVEEDOR_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const proveedorDB = await findProveedorById({
      provemid: user.usemid,
      provid,
    });

    if (!proveedorDB) {
      throw new Error('Proveedor not found');
    }

    return mapProveedorRowToResponse(proveedorDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        proveedorId: provid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading proveedor',
    );
    throw error;
  }
}

async function readProveedores(
  params: FindProveedoresParamsDto,
  user: LoginUserDto,
): Promise<FindProveedoresResponseDto> {
  const validatedParams = validateFindProveedoresParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const proveedoresDB = await findProveedores(validatedParams, user.usemid);

    return mapFindProveedoresResponse(proveedoresDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading proveedores',
    );
    throw error;
  }
}

async function updateProveedor(proveedor: UpdateProveedorDto, user: LoginUserDto): Promise<ProveedorResponseDto | null> {
  const provid = validateRequiredString(proveedor.provid, EMPTY_PROVEEDOR_ID_MESSAGE);
  const provnombre = proveedor.provnombre !== undefined
    ? validateRequiredString(proveedor.provnombre, EMPTY_PROVEEDOR_NAME_MESSAGE)
    : undefined;
  const provctgriaid = proveedor.provctgriaid !== undefined
    ? (proveedor.provctgriaid === null
      ? null
      : validateRequiredString(proveedor.provctgriaid, EMPTY_PROVEEDOR_CATEGORY_ID_MESSAGE))
    : undefined;
  const provmrcid = proveedor.provmrcid !== undefined
    ? (proveedor.provmrcid === null
      ? null
      : validateRequiredString(proveedor.provmrcid, EMPTY_PROVEEDOR_BRAND_ID_MESSAGE))
    : undefined;
  const provtelefono = proveedor.provtelefono !== undefined
    ? (proveedor.provtelefono === null
      ? null
      : validatePhone(proveedor.provtelefono, EMPTY_PROVEEDOR_PHONE_MESSAGE, INVALID_PROVEEDOR_PHONE_MESSAGE))
    : undefined;
  const provcorreo = proveedor.provcorreo !== undefined
    ? (proveedor.provcorreo === null
      ? null
      : validateEmail(proveedor.provcorreo, EMPTY_PROVEEDOR_EMAIL_MESSAGE, INVALID_PROVEEDOR_EMAIL_MESSAGE))
    : undefined;
  const provestado = proveedor.provestado !== undefined
    ? validateStatus(proveedor.provestado, EMPTY_PROVEEDOR_STATUS_MESSAGE, INVALID_PROVEEDOR_UPDATE_STATUS_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const proveedorDB = await findProveedorById({
      provemid: user.usemid,
      provid,
    });

    if (!proveedorDB) {
      throw new Error('Proveedor not found');
    }

    if (proveedorDB.provestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_PROVEEDOR_MESSAGE);
    }

    if (provnombre !== undefined) {
      const proveedorByNameDB = await findProveedorByName({
        provemid: user.usemid,
        provnombre,
      });

      if (proveedorByNameDB && proveedorByNameDB.provid !== provid) {
        throw new Error(INVALID_PROVEEDOR_EXISTS_MESSAGE);
      }
    }

    if (provctgriaid !== undefined && provctgriaid !== null && provctgriaid !== proveedorDB.provctgriaid) {
      const categoryDB = await findCategoryById({
        ctgriaemid: user.usemid,
        ctgriaid: provctgriaid,
      });

      if (!categoryDB) {
        throw new Error('Proveedor category does not exist');
      }

      if ([ 'inactivo', 'eliminado' ].includes(categoryDB.ctgriaestado)) {
        throw new Error('Proveedor category is not active');
      }
    }

    if (provmrcid !== undefined && provmrcid !== null && provmrcid !== proveedorDB.provmrcid) {
      const brandDB = await findBrandById({
        mrcemid: user.usemid,
        mrcid: provmrcid,
      });

      if (!brandDB) {
        throw new Error('Proveedor brand does not exist');
      }

      if ([ 'inactivo', 'eliminado' ].includes(brandDB.mrcestado)) {
        throw new Error('Proveedor brand is not active');
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    const proveedorCategoryId = proveedorDB.provctgriaid;
    const proveedorBrandId = proveedorDB.provmrcid;

    if (provctgriaid !== undefined && provctgriaid !== proveedorCategoryId) {
      dataDB.push({ column: 'provctgriaid', value: provctgriaid });
    }

    if (provmrcid !== undefined && provmrcid !== proveedorBrandId) {
      dataDB.push({ column: 'provmrcid', value: provmrcid });
    }

    if (provnombre !== undefined && provnombre !== proveedorDB.provnombre) {
      dataDB.push({ column: 'provnombre', value: provnombre });
    }

    if (provtelefono !== undefined && provtelefono !== proveedorDB.provtelefono) {
      dataDB.push({ column: 'provtelefono', value: provtelefono });
    }

    if (provcorreo !== undefined && provcorreo !== proveedorDB.provcorreo) {
      dataDB.push({ column: 'provcorreo', value: provcorreo });
    }

    if (provestado !== undefined && provestado !== proveedorDB.provestado) {
      dataDB.push({ column: 'provestado', value: provestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_PROVEEDOR_MESSAGE);
    }

    const updatedProveedorId = await updateProveedorById(dataDB, {
      provemid: user.usemid,
      provid,
    });

    if (!updatedProveedorId) {
      throw new Error('Proveedor not found');
    }

    const updatedProveedorDB = await findProveedorById({
      provemid: user.usemid,
      provid: updatedProveedorId,
    });

    if (!updatedProveedorDB) {
      throw new Error('Proveedor not found');
    }

    return mapProveedorRowToResponse(updatedProveedorDB);
    
  } catch (error) {
    logger.error(
      {
        err: error,
        proveedorId: provid,
        hasCategory: provctgriaid !== undefined,
        hasBrand: provmrcid !== undefined,
        hasName: provnombre !== undefined,
        hasPhone: provtelefono !== undefined,
        hasEmail: provcorreo !== undefined,
        hasStatus: provestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating proveedor',
    );
    throw error;
  }
}

export { createProveedor, readProveedor, readProveedores, updateProveedor };
