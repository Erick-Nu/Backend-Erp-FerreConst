import { findCompanyById } from '../company/companyDao.js';
import type { LoginUserDto } from '../auth/authDto.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import {
  validateBranchIdentifier,
  validateEmail,
  validateRequiredString,
  validateStatus,
} from '../../utils/validation.js';
import type {
  BranchResponseDto,
  CreateBranchDto,
  FindBranchDto,
  FindBranchesParamsDto,
  FindBranchesResponseDto,
  UpdateBranchDto,
} from './branchDto.js';
import {
  findBranchById,
  findBranchByIdentifier,
  findBranches,
  saveBranch,
  updateBranchById,
} from './branchDao.js';
import { createSequence } from '../sequence/sequenceService.js';

const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_BRANCH_NAME_MESSAGE = 'El nombre de sucursal es requerido';
const EMPTY_BRANCH_IDENTIFIER_MESSAGE = 'El identificador de sucursal es requerido';
const EMPTY_BRANCH_STATUS_MESSAGE = 'El estado de sucursal es requerido';
const EMPTY_BRANCH_EMAIL_MESSAGE = 'El correo de sucursal es requerido';
const EMPTY_BRANCH_ADDRESS_MESSAGE = 'La dirección de sucursal es requerida';
const INVALID_BRANCH_EMAIL_MESSAGE = 'El correo de sucursal debe ser válido';
const INVALID_BRANCH_UPDATE_STATUS_MESSAGE = 'El estado de sucursal debe ser activo, inactivo o eliminado';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es empresa padre';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const FORBIDDEN_ROL_USER_JEFE_MESSAGE = 'El usuario no es jefe';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no esta activo';
const INVALID_COMPANY_FIND_USER_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const FORBIDDEN_CROSS_COMPANY_BRANCH_CREATION_MESSAGE = 'El usuario no puede crear sucursales para otra empresa';
const INVALID_PAGE_MESSAGE = 'La página debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamaño de página debe ser un entero positivo';
const EMPTY_BRANCH_ID_MESSAGE = 'El id de sucursal es requerido';
const EMPTY_UPDATE_BRANCH_MESSAGE = 'Al menos un campo es requerido para actualizar la sucursal';
const FORBIDDEN_UPDATE_DELETED_BRANCH_MESSAGE = 'La sucursal eliminada no puede ser actualizada';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateFindBranchesParams(params: FindBranchesParamsDto): FindBranchesParamsDto {
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

  const validatedParams: FindBranchesParamsDto = {
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

  const userDB = await findUserById({ usid: user.usid, usemid: user.usemid,});
  if (!userDB) {
    throw new Error(INVALID_COMPANY_FIND_USER_MESSAGE);
  }

  const isUserCompany = userDB.usemid;
  if (isUserCompany !== user.usemid) {
    throw new Error(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE);
  }

  if (targetCompanyId && targetCompanyId !== user.usemid) {
    throw new Error(FORBIDDEN_CROSS_COMPANY_BRANCH_CREATION_MESSAGE);
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


async function createBranch(branch: CreateBranchDto, user: LoginUserDto): Promise<BranchResponseDto> {
  const suemid = validateRequiredString(branch.suemid, EMPTY_COMPANY_ID_MESSAGE);
  const sunombre = validateRequiredString(branch.sunombre, EMPTY_BRANCH_NAME_MESSAGE);
  const suidentificador = validateBranchIdentifier(branch.suidentificador, EMPTY_BRANCH_IDENTIFIER_MESSAGE);
  const sudireccion = branch.sudireccion ?? null;
  let sucorreo = branch.sucorreo ?? null;

  if (sucorreo) {
    sucorreo = validateEmail(sucorreo, EMPTY_BRANCH_EMAIL_MESSAGE, INVALID_BRANCH_EMAIL_MESSAGE);
  }

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: suemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const requesterUser = await findUserById({
      usid: user.usid,
      usemid: user.usemid,
    });

    if (!requesterUser) {
      throw new Error(INVALID_COMPANY_FIND_USER_MESSAGE);
    }

    if (requesterUser.usrol !== 'jefe') {
      throw new Error(FORBIDDEN_ROL_USER_JEFE_MESSAGE);
    }

    const branchIdentifier = { suemid, suidentificador };

    const identifierDB = await findBranchByIdentifier(branchIdentifier);
    
    if (identifierDB) {
      throw new Error('Ya existe una sucursal con ese identificador');
    };

    const branchDB: CreateBranchDto = {
      suemid,
      sunombre,
      suidentificador,
      sudireccion,
      sucorreo
    };

    const branchId = await saveBranch(branchDB);

    await createSequence({
      seemid: suemid,
      sesuid: branchId,
    });
    
    const newBranch = await findBranchById({ suemid, suid: branchId });

    return newBranch!;
    
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: suemid,
        identifier: suidentificador,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating branch',
    );
    throw error;
  }
}

async function readBranches(params: FindBranchesParamsDto, user: LoginUserDto): Promise<FindBranchesResponseDto> {
  const validatedParams = validateFindBranchesParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const branchesDB = await findBranches(validatedParams, user.usemid);

    return branchesDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading branches',
    );
    throw error;
  }
}

async function readBranch(branch: FindBranchDto, user: LoginUserDto): Promise<BranchResponseDto | null> {
  const suid = validateRequiredString(branch.suid, EMPTY_BRANCH_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const branchDB = await findBranchById({
      suemid: user.usemid,
      suid,
    });
    if (!branchDB) {
      throw new Error('Sucursal no encontrada');
    }

    return branchDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        branchId: suid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading branch',
    );
    throw error;
  }
}

async function updateBranch(branch: UpdateBranchDto, user: LoginUserDto): Promise<BranchResponseDto | null> {
  const suid = validateRequiredString(branch.suid, EMPTY_BRANCH_ID_MESSAGE);
  const sunombre = branch.sunombre !== undefined
    ? validateRequiredString(branch.sunombre, EMPTY_BRANCH_NAME_MESSAGE)
    : undefined;
  const sudireccion = branch.sudireccion !== undefined
    ? (branch.sudireccion === null ? null : validateRequiredString(branch.sudireccion, EMPTY_BRANCH_ADDRESS_MESSAGE))
    : undefined;
  const sucorreo = branch.sucorreo !== undefined
    ? (branch.sucorreo === null
      ? null
      : validateEmail(branch.sucorreo, EMPTY_BRANCH_EMAIL_MESSAGE, INVALID_BRANCH_EMAIL_MESSAGE))
    : undefined;
  const suidentificador = branch.suidentificador !== undefined
    ? validateBranchIdentifier(branch.suidentificador, EMPTY_BRANCH_IDENTIFIER_MESSAGE)
    : undefined;
  const suestado = branch.suestado !== undefined
    ? validateStatus(branch.suestado, EMPTY_BRANCH_STATUS_MESSAGE, INVALID_BRANCH_UPDATE_STATUS_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const requesterUser = await findUserById({
      usid: user.usid,
      usemid: user.usemid,
    });

    if (!requesterUser) {
      throw new Error(INVALID_COMPANY_FIND_USER_MESSAGE);
    }

    if (requesterUser.usrol !== 'jefe') {
      throw new Error(FORBIDDEN_ROL_USER_JEFE_MESSAGE);
    }

    const branchDB = await findBranchById({
      suemid: user.usemid,
      suid,
    });

    if (!branchDB) {
      throw new Error('Sucursal no encontrada');
    }

    if (branchDB.suestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_BRANCH_MESSAGE);
    }

    if (suidentificador !== undefined) {
      const identifierDB = await findBranchByIdentifier({
        suemid: user.usemid,
        suidentificador,
      });

      if (identifierDB && identifierDB !== suid) {
        throw new Error('Ya existe una sucursal con ese identificador');
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    if (sunombre !== undefined && sunombre !== branchDB.sunombre) {
      dataDB.push({ column: 'sunombre', value: sunombre });
    }

    if (sudireccion !== undefined && sudireccion !== branchDB.sudireccion) {
      dataDB.push({ column: 'sudireccion', value: sudireccion });
    }

    if (sucorreo !== undefined && sucorreo !== branchDB.sucorreo) {
      dataDB.push({ column: 'sucorreo', value: sucorreo });
    }

    if (suidentificador !== undefined && suidentificador !== branchDB.suidentificador) {
      dataDB.push({ column: 'suidentificador', value: suidentificador });
    }

    if (suestado !== undefined && suestado !== branchDB.suestado) {
      dataDB.push({ column: 'suestado', value: suestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_BRANCH_MESSAGE);
    }

    const updatedBranchDB = await updateBranchById(dataDB, {
      suemid: user.usemid,
      suid,
    });

    if (!updatedBranchDB) {
      return null;
    }

    return updatedBranchDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        branchId: suid,
        hasName: sunombre !== undefined,
        hasAddress: sudireccion !== undefined,
        hasEmail: sucorreo !== undefined,
        hasIdentifier: suidentificador !== undefined,
        hasStatus: suestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating branch',
    );
    throw error;
  }
}

export { createBranch, readBranches, readBranch, updateBranch, validateCompanyAndUserAccess };
