import type { LoginUserDto } from '../auth/authDto.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import { validateRequiredString, validateStatus } from '../../utils/validation.js';
import type {
  CreatePlaymentMethodDto,
  FindPlaymentMethodDto,
  FindPlaymentMethodsParamsDto,
  FindPlaymentMethodsResponseDto,
  PlaymentMethodResponseDto,
  UpdatePlaymentMethodDto,
} from './playmentMethodDto.js';
import {
  findPlaymentMethodById,
  findPlaymentMethodByName,
  findPlaymentMethods,
  savePlaymentMethod,
  updatePlaymentMethodById,
} from './playmentMethodDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_PLAYMENT_METHOD_NAME_MESSAGE = 'El nombre de método de pago es requerido';
const EMPTY_PLAYMENT_METHOD_ID_MESSAGE = 'El id de método de pago es requerido';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no está activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no está activo';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE = 'El usuario no es jefe o empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es empresa padre';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const INVALID_PAGE_MESSAGE = 'La página debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamaño de página debe ser un entero positivo';
const INVALID_PLAYMENT_METHOD_EXISTS_MESSAGE = 'Ya existe un método de pago con ese nombre';
const EMPTY_PLAYMENT_METHOD_STATUS_MESSAGE = 'El estado de método de pago es requerido';
const INVALID_PLAYMENT_METHOD_UPDATE_STATUS_MESSAGE = 'El estado de método de pago debe ser activo, inactivo o eliminado';
const EMPTY_UPDATE_PLAYMENT_METHOD_MESSAGE = 'Al menos un campo es requerido para actualizar el método de pago';
const FORBIDDEN_UPDATE_DELETED_PLAYMENT_METHOD_MESSAGE = 'El método de pago eliminado no puede ser actualizado';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateFindPlaymentMethodsParams(
  params: FindPlaymentMethodsParamsDto,
): FindPlaymentMethodsParamsDto {
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

  const validatedParams: FindPlaymentMethodsParamsDto = {
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

async function createPlaymentMethod(
  playmentMethod: CreatePlaymentMethodDto,
  user: LoginUserDto,
): Promise<PlaymentMethodResponseDto> {
  const mpemid = validateRequiredString(playmentMethod.mpemid, EMPTY_COMPANY_ID_MESSAGE);
  const mpnombre = validateRequiredString(playmentMethod.mpnombre, EMPTY_PLAYMENT_METHOD_NAME_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: mpemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const playmentMethodByNameDB = await findPlaymentMethodByName({
      mpemid,
      mpnombre,
    });

    if (playmentMethodByNameDB) {
      throw new Error(INVALID_PLAYMENT_METHOD_EXISTS_MESSAGE);
    }

    const playmentMethodId = await savePlaymentMethod({
      mpemid,
      mpnombre,
    });

    const newPlaymentMethod = await findPlaymentMethodById({
      mpemid,
      mpid: playmentMethodId,
    });

    return newPlaymentMethod!;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: mpemid,
        playmentMethodName: mpnombre,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating playment method',
    );
    throw error;
  }
}

async function readPlaymentMethod(
  playmentMethod: FindPlaymentMethodDto,
  user: LoginUserDto,
): Promise<PlaymentMethodResponseDto | null> {
  const mpid = validateRequiredString(playmentMethod.mpid, EMPTY_PLAYMENT_METHOD_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const playmentMethodDB = await findPlaymentMethodById({
      mpemid: user.usemid,
      mpid,
    });

    if (!playmentMethodDB) {
      throw new Error('Método de pago no encontrado');
    }

    return playmentMethodDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        playmentMethodId: mpid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading playment method',
    );
    throw error;
  }
}

async function readPlaymentMethods(
  params: FindPlaymentMethodsParamsDto,
  user: LoginUserDto,
): Promise<FindPlaymentMethodsResponseDto> {
  const validatedParams = validateFindPlaymentMethodsParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const playmentMethodsDB = await findPlaymentMethods(validatedParams, user.usemid);

    return playmentMethodsDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading playment methods',
    );
    throw error;
  }
}

async function updatePlaymentMethod(
  playmentMethod: UpdatePlaymentMethodDto,
  user: LoginUserDto,
): Promise<PlaymentMethodResponseDto | null> {
  const mpid = validateRequiredString(playmentMethod.mpid, EMPTY_PLAYMENT_METHOD_ID_MESSAGE);
  const mpnombre = playmentMethod.mpnombre !== undefined
    ? validateRequiredString(playmentMethod.mpnombre, EMPTY_PLAYMENT_METHOD_NAME_MESSAGE)
    : undefined;
  const mpestado = playmentMethod.mpestado !== undefined
    ? validateStatus(
      playmentMethod.mpestado,
      EMPTY_PLAYMENT_METHOD_STATUS_MESSAGE,
      INVALID_PLAYMENT_METHOD_UPDATE_STATUS_MESSAGE,
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

    const playmentMethodDB = await findPlaymentMethodById({
      mpemid: user.usemid,
      mpid,
    });

    if (!playmentMethodDB) {
      return null;
    }

    if (playmentMethodDB.mpestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_PLAYMENT_METHOD_MESSAGE);
    }

    if (mpnombre !== undefined) {
      const playmentMethodByNameDB = await findPlaymentMethodByName({
        mpemid: user.usemid,
        mpnombre,
      });

      if (playmentMethodByNameDB && playmentMethodByNameDB.mpid !== mpid) {
        throw new Error(INVALID_PLAYMENT_METHOD_EXISTS_MESSAGE);
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    if (mpnombre !== undefined && mpnombre !== playmentMethodDB.mpnombre) {
      dataDB.push({ column: 'mpnombre', value: mpnombre });
    }

    if (mpestado !== undefined && mpestado !== playmentMethodDB.mpestado) {
      dataDB.push({ column: 'mpestado', value: mpestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_PLAYMENT_METHOD_MESSAGE);
    }

    const updatedPlaymentMethodDB = await updatePlaymentMethodById(dataDB, {
      mpemid: user.usemid,
      mpid,
    });

    if (!updatedPlaymentMethodDB) {
      return null;
    }

    return updatedPlaymentMethodDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        playmentMethodId: mpid,
        hasName: mpnombre !== undefined,
        hasStatus: mpestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating playment method',
    );
    throw error;
  }
}

export {
  createPlaymentMethod,
  readPlaymentMethod,
  readPlaymentMethods,
  updatePlaymentMethod,
};
