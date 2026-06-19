import type {
  CreateCompanyDto,
  CompanyResponseDto,
  FindCompaniesParamsDto,
  FindCompaniesResponseDto,
  UpdateCompanyDto,
  UpdateStatusCompanyDto,
  FindCompanyDto
} from './companyDto.js';
import type { LoginUserDto } from '../auth/authDto.js';
import {
  findUserById
} from '../user/userDao.js';
import {
  updateCompanyById,
  updateCompanyStatus,
  findCompanies,
  findCompanyById,
  findCompanyByCode,
  findCompanyByEmail,
  findCompanyByRuc,
  saveCompany,
} from './companyDao.js';
import { toPublicImageUrl } from '../../middlewares/uploadImage.js';
import { logger } from '../../utils/logger.js';
import {
  validateCodeCompany,
  validateEmail,
  validateRequiredString,
  validateStatus,
  validateRuc,
} from '../../utils/validation.js';

const EMPTY_RUC_MESSAGE = 'El RUC de la empresa es requerido';
const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_COMPANY_NAME_MESSAGE = 'La razon social de empresa es requerida';
const EMPTY_COMPANY_EMAIL_MESSAGE = 'El correo de empresa es requerido';
const EMPTY_COMPANY_CODE_MESSAGE = 'El código de empresa es requerido';
const EMPTY_COMPANY_STATUS_MESSAGE = 'El estado de empresa es requerido';
const EMPTY_COMPANY_LOGO_MESSAGE = 'El logo de empresa es requerido';
const INVALID_COMPANY_EMAIL_MESSAGE = 'El correo de empresa debe ser válido';
const INVALID_COMPANY_CODE_MESSAGE = 'El código de empresa debe tener exactamente 4 caracteres alfanumericos';
const INVALID_COMPANY_UPDATE_STATUS_MESSAGE = 'El estado de empresa debe ser activo, inactivo o eliminado';
const EMPTY_UPDATE_COMPANY_MESSAGE = 'Al menos un campo es requerido para actualizar la empresa';
const FORBIDDEN_UPDATE_DELETED_COMPANY_MESSAGE = 'La empresa eliminada no puede cambiar de estado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es empresa padre';
const INVALID_COMPANY_FIND_MESSAGE = 'El código de empresa no es inválido';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no esta activo';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const INVALID_PAGE_MESSAGE = 'La página debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'Page size must be a positive integer';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateFindCompaniesParams(params: FindCompaniesParamsDto): FindCompaniesParamsDto {
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

  const validatedParams: FindCompaniesParamsDto = {
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

  const company = await findCompanyById(user.usemid);
  if (!company) {
    throw new Error(INVALID_COMPANY_FIND_MESSAGE);
  }

  const isActiveCompany = company.emestado;
  if (isActiveCompany !== 'activo') {
    throw new Error(INVALID_COMPANY_STATUS_MESSAGE);
  }

  if (requireParentCompany && !company.empadre) {
    throw new Error(FORBIDDEN_COMPANY_CREATION_MESSAGE);
  }

  const userCompany = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });
  if (!userCompany) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  const isUserCompany = userCompany.usemid;
  if (isUserCompany !== user.usemid) {
    throw new Error(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE);
  }

  if (targetCompanyId && targetCompanyId !== user.usemid) {
    throw new Error(FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE);
  }

  if (requireAdminUser && userCompany.usrol !== 'administrador') {
    throw new Error(FORBIDDEN_ROL_USER_ADMIN_MESSAGE);
  }

  if (!requireAdminUser && !['jefe', 'empleado', 'administrador'].includes(userCompany.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_MESSAGE);
  }

  const isActiveUser = userCompany.usestado;
  if (isActiveUser !== 'activo') {
    throw new Error(INVALID_USER_STATUS_MESSAGE);
  }
}


async function createCompany(company: CreateCompanyDto, user: LoginUserDto): Promise<CompanyResponseDto> {
  const emruc = validateRequiredString(company.emruc, EMPTY_RUC_MESSAGE);
  validateRuc(emruc);
  const emrznsocial = validateRequiredString(company.emrznsocial, EMPTY_COMPANY_NAME_MESSAGE);
  const emcorreo = validateEmail(company.emcorreo, EMPTY_COMPANY_EMAIL_MESSAGE, INVALID_COMPANY_EMAIL_MESSAGE);
  const emlogo = company.emlogo;
  const emcodigo = validateCodeCompany(company.emcodigo, EMPTY_COMPANY_CODE_MESSAGE, INVALID_COMPANY_CODE_MESSAGE).toUpperCase();

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    }
    await validateCompanyAndUserAccess(user, access);

    const companyByRucDB = await findCompanyByRuc(emruc);
    if (companyByRucDB) {
      throw new Error('Ya existe una empresa con ese RUC');
    }

    const companyByEmailDB = await findCompanyByEmail(emcorreo);
    if (companyByEmailDB) {
      throw new Error('Ya existe una empresa con ese correo');
    }

    const companyByCodeDB = await findCompanyByCode(emcodigo);
    if (companyByCodeDB) {
      throw new Error('Ya existe una empresa con ese código');
    }

    const companyDB: CreateCompanyDto = {
      emruc,
      emrznsocial,
      emcorreo,
      emlogo,
      emcodigo,
    };

    const companyId = await saveCompany(companyDB);
    const newCompanyDB = await findCompanyById(companyId);

    if (!newCompanyDB) {
      throw new Error('La empresa no fue creada');
    }

    const companyResponse: CompanyResponseDto = {
      emid: newCompanyDB.emid,
      emruc: newCompanyDB.emruc,
      emrznsocial: newCompanyDB.emrznsocial,
      emcorreo: newCompanyDB.emcorreo,
      emlogo: toPublicImageUrl(newCompanyDB.emlogo),
      emcodigo: newCompanyDB.emcodigo,
      emfchregistro: newCompanyDB.emfchregistro,
      emestado: newCompanyDB.emestado,
    };

    return companyResponse;
    
  } catch (error) {
    logger.error(
      {
        err: error,
        ruc: emruc,
        email: emcorreo,
        code: emcodigo,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating company',
    );
    throw error;
  }
}


async function readCompanies(params: FindCompaniesParamsDto, user: LoginUserDto,): Promise<FindCompaniesResponseDto> {
  const validatedParams = validateFindCompaniesParams(params);

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    }
    await validateCompanyAndUserAccess(user, access);
    const companiesDB = await findCompanies(validatedParams);
    const companiesResponse: FindCompaniesResponseDto = {
      ...companiesDB,
      items: companiesDB.items.map((company): CompanyResponseDto => ({
        ...company,
        emlogo: toPublicImageUrl(company.emlogo),
      })),
    };

    return companiesResponse;

  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading companies',
    );
    throw error;
  }
}

async function readCompany(id: FindCompanyDto, user: LoginUserDto): Promise<CompanyResponseDto | null> {
  const validatedId = validateRequiredString(id.emid, 'Company id is required');

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: validatedId,
    }

    await validateCompanyAndUserAccess(user, access);

    const companyDB = await findCompanyById(validatedId);
    if (!companyDB) {
      throw new Error('Empresa no encontrada');
    }

    const companyResponse: CompanyResponseDto = {
      emid: companyDB.emid,
      emruc: companyDB.emruc,
      emrznsocial: companyDB.emrznsocial,
      emcorreo: companyDB.emcorreo,
      emlogo: toPublicImageUrl(companyDB.emlogo),
      emcodigo: companyDB.emcodigo,
      emfchregistro: companyDB.emfchregistro,
      emestado: companyDB.emestado,
    }

    return companyResponse;

  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: validatedId,
      },
      'Error reading company',
    );
    throw error;
  } 
}

async function updateCompanyWithStatus(company: UpdateStatusCompanyDto, user: LoginUserDto): Promise<boolean> {
  const emid = validateRequiredString(company.emid, EMPTY_COMPANY_ID_MESSAGE);
  const emestado = validateStatus(company.emestado, EMPTY_COMPANY_STATUS_MESSAGE, INVALID_COMPANY_UPDATE_STATUS_MESSAGE);

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    }
    await validateCompanyAndUserAccess(user, access);

    const companyDB = await findCompanyById(emid);
    if (!companyDB) {
      return false;
    }

    if (companyDB.emestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_COMPANY_MESSAGE);
    }

    const updated = await updateCompanyStatus({
      emid,
      emestado,
    });

    return updated;

  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: emid,
        newStatus: emestado,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating company status',
    );
    throw error;
  } 
}

async function updateCompany(company: UpdateCompanyDto, user: LoginUserDto): Promise<CompanyResponseDto | null> {
  const emid = validateRequiredString(company.emid, EMPTY_COMPANY_ID_MESSAGE);
  const emrznsocial = company.emrznsocial !== undefined
    ? validateRequiredString(company.emrznsocial, EMPTY_COMPANY_NAME_MESSAGE)
    : undefined;
  const emcorreo = company.emcorreo !== undefined
    ? validateEmail(company.emcorreo, EMPTY_COMPANY_EMAIL_MESSAGE, INVALID_COMPANY_EMAIL_MESSAGE)
    : undefined;
  const emlogo = company.emlogo !== undefined
    ? validateRequiredString(company.emlogo, EMPTY_COMPANY_LOGO_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: emid
    };

    await validateCompanyAndUserAccess(user, access);

    const companyDB = await findCompanyById(emid);

    if (!companyDB) {
      return null;
    }

    if (companyDB.emestado !== 'activo') {
      throw new Error('La empresa inactiva o eliminada no puede ser actualizada');
    }

    if (emcorreo) {
      const companyByEmailDB = await findCompanyByEmail(emcorreo);
      if (companyByEmailDB) {
        throw new Error('Ya existe una empresa con ese correo');
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date;
    }[] = [];

    if (emrznsocial !== undefined && emrznsocial !== companyDB.emrznsocial) {
      dataDB.push({ column: 'emrznsocial', value: emrznsocial });
    }

    if (emcorreo !== undefined && emcorreo !== companyDB.emcorreo) {
      dataDB.push({ column: 'emcorreo', value: emcorreo });
    }

    if (emlogo !== undefined && emlogo !== companyDB.emlogo) {
      dataDB.push({ column: 'emlogo', value: emlogo });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_COMPANY_MESSAGE);
    }

    const updatedCompanyDB = await updateCompanyById(dataDB, emid);

    if (!updatedCompanyDB) {
      throw new Error('Error al actualizar la empresa');
    }

    const companyResponse: CompanyResponseDto = {
      emid: updatedCompanyDB.emid,
      emruc: updatedCompanyDB.emruc,
      emrznsocial: updatedCompanyDB.emrznsocial,
      emcorreo: updatedCompanyDB.emcorreo,
      emlogo: toPublicImageUrl(updatedCompanyDB.emlogo),
      emcodigo: updatedCompanyDB.emcodigo,
      emfchregistro: updatedCompanyDB.emfchregistro,
      emestado: updatedCompanyDB.emestado,
    };

    return companyResponse;
    
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: emid,
        hasSocialReason: emrznsocial !== undefined,
        hasEmail: emcorreo !== undefined,
        hasLogo: emlogo !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating company',
    );
    throw error;
  }
}

export { createCompany, readCompanies, readCompany, updateCompanyWithStatus, updateCompany };
