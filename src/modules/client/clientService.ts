import type { LoginUserDto } from '../auth/authDto.js';
import type { Identification } from '../../config/databaseTypes.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import {
  validateEmail,
  validateIdentificationByType,
  validatePhone,
  validateRequiredString,
  validateStatus,
} from '../../utils/validation.js';
import type {
  ClientResponseDto,
  CreateClientDto,
  FindClientDto,
  FindClientsParamsDto,
  FindClientsResponseDto,
  UpdateClientDto,
} from './clientDto.js';
import {
  findClientByEmail,
  findClientById,
  findClientByIdentification,
  findClients,
  saveClient,
  updateClientById,
} from './clientDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_CLIENT_ID_MESSAGE = 'El id de cliente es requerido';
const EMPTY_CLIENT_TYPE_IDENTIFICATION_MESSAGE = 'El tipo de identificación de cliente es requerido';
const EMPTY_CLIENT_IDENTIFICATION_MESSAGE = 'La identificación de cliente es requerida';
const EMPTY_CLIENT_NAME_MESSAGE = 'El nombre de cliente es requerido';
const EMPTY_CLIENT_EMAIL_MESSAGE = 'El correo de cliente es requerido';
const EMPTY_CLIENT_ADDRESS_MESSAGE = 'La dirección de cliente es requerida';
const EMPTY_CLIENT_PHONE_MESSAGE = 'El teléfono de cliente es requerido';
const EMPTY_CLIENT_STATUS_MESSAGE = 'El estado de cliente es requerido';
const INVALID_CLIENT_TYPE_IDENTIFICATION_MESSAGE = 'El tipo de identificación debe ser cedula o ruc';
const INVALID_CLIENT_IDENTIFICATION_MESSAGE = 'La identificación debe ser válida para el tipo seleccionado';
const INVALID_CLIENT_EMAIL_MESSAGE = 'El correo de cliente debe ser válido';
const INVALID_CLIENT_PHONE_MESSAGE = 'El teléfono de cliente debe ser válido';
const INVALID_CLIENT_UPDATE_STATUS_MESSAGE = 'El estado de cliente debe ser activo, inactivo o eliminado';
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
const INVALID_CLIENT_EXISTS_IDENTIFICATION_MESSAGE = 'Ya existe un cliente con esa identificación';
const INVALID_CLIENT_EXISTS_EMAIL_MESSAGE = 'Ya existe un cliente con ese correo';
const EMPTY_UPDATE_CLIENT_MESSAGE = 'Al menos un campo es requerido para actualizar el cliente';
const FORBIDDEN_UPDATE_DELETED_CLIENT_MESSAGE = 'El cliente eliminado no puede ser actualizado';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateClientIdentificationType(
  value: string,
  requiredMessage: string,
  invalidMessage: string,
): Identification {
  const cleanedValue = validateRequiredString(value, requiredMessage).toLowerCase();

  if (cleanedValue === 'cedula' || cleanedValue === 'ruc') {
    return cleanedValue;
  }

  throw new Error(invalidMessage);
}

function validateFindClientsParams(params: FindClientsParamsDto): FindClientsParamsDto {
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

  const validatedParams: FindClientsParamsDto = {
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

async function createClient(client: CreateClientDto, user: LoginUserDto): Promise<ClientResponseDto> {
  const clnteemid = validateRequiredString(client.clnteemid, EMPTY_COMPANY_ID_MESSAGE);
  const clntetipoidentificacion = validateClientIdentificationType(client.clntetipoidentificacion, EMPTY_CLIENT_TYPE_IDENTIFICATION_MESSAGE, INVALID_CLIENT_TYPE_IDENTIFICATION_MESSAGE);
  const clnteidentificacion = validateIdentificationByType(client.clnteidentificacion, clntetipoidentificacion, EMPTY_CLIENT_IDENTIFICATION_MESSAGE, INVALID_CLIENT_IDENTIFICATION_MESSAGE);
  const clntenombre = validateRequiredString(client.clntenombre, EMPTY_CLIENT_NAME_MESSAGE);
  const clntecorreo = validateEmail(client.clntecorreo, EMPTY_CLIENT_EMAIL_MESSAGE, INVALID_CLIENT_EMAIL_MESSAGE);
  const clntedireccion = validateRequiredString(client.clntedireccion, EMPTY_CLIENT_ADDRESS_MESSAGE);
  const clntetelefono = validatePhone(client.clntetelefono, EMPTY_CLIENT_PHONE_MESSAGE, INVALID_CLIENT_PHONE_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: clnteemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const clientByIdentificationDB = await findClientByIdentification({
      clnteemid,
      clnteidentificacion,
    });

    if (clientByIdentificationDB) {
      throw new Error(INVALID_CLIENT_EXISTS_IDENTIFICATION_MESSAGE);
    }

    const clientByEmailDB = await findClientByEmail({
      clnteemid,
      clntecorreo,
    });

    if (clientByEmailDB) {
      throw new Error(INVALID_CLIENT_EXISTS_EMAIL_MESSAGE);
    }

    const clientId = await saveClient({
      clnteemid,
      clntetipoidentificacion,
      clnteidentificacion,
      clntenombre,
      clntecorreo,
      clntedireccion,
      clntetelefono,
    });

    const clientDB = await findClientById({
      clnteemid,
      clnteid: clientId,
    });

    if (!clientDB) {
      throw new Error('El cliente no fue creado');
    }

    return clientDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: clnteemid,
        identification: clnteidentificacion,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating client',
    );
    throw error;
  }
}

async function readClient(client: FindClientDto, user: LoginUserDto): Promise<ClientResponseDto | null> {
  const clnteid = validateRequiredString(client.clnteid, EMPTY_CLIENT_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const clientDB = await findClientById({
      clnteemid: user.usemid,
      clnteid,
    });

    if (!clientDB) {
      throw new Error('Cliente no encontrado');
    }

    return clientDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        clientId: clnteid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading client',
    );
    throw error;
  }
}

async function readClients(
  params: FindClientsParamsDto,
  user: LoginUserDto,
): Promise<FindClientsResponseDto> {
  const validatedParams = validateFindClientsParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const clientsDB = await findClients(validatedParams, user.usemid);

    return clientsDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        search: validatedParams.search,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading clients',
    );
    throw error;
  }
}

async function updateClient(client: UpdateClientDto, user: LoginUserDto): Promise<ClientResponseDto | null> {
  const clnteid = validateRequiredString(client.clnteid, EMPTY_CLIENT_ID_MESSAGE);
  const clntetipoidentificacion = client.clntetipoidentificacion !== undefined
    ? validateClientIdentificationType(
      client.clntetipoidentificacion,
      EMPTY_CLIENT_TYPE_IDENTIFICATION_MESSAGE,
      INVALID_CLIENT_TYPE_IDENTIFICATION_MESSAGE,
    )
    : undefined;
  const clntenombre = client.clntenombre !== undefined
    ? validateRequiredString(client.clntenombre, EMPTY_CLIENT_NAME_MESSAGE)
    : undefined;
  const clntecorreo = client.clntecorreo !== undefined
    ? (client.clntecorreo === null
      ? null
      : validateEmail(client.clntecorreo, EMPTY_CLIENT_EMAIL_MESSAGE, INVALID_CLIENT_EMAIL_MESSAGE))
    : undefined;
  const clntedireccion = client.clntedireccion !== undefined
    ? (client.clntedireccion === null
      ? null
      : validateRequiredString(client.clntedireccion, EMPTY_CLIENT_ADDRESS_MESSAGE))
    : undefined;
  const clntetelefono = client.clntetelefono !== undefined
    ? (client.clntetelefono === null
      ? null
      : validatePhone(client.clntetelefono, EMPTY_CLIENT_PHONE_MESSAGE, INVALID_CLIENT_PHONE_MESSAGE))
    : undefined;
  const clnteestado = client.clnteestado !== undefined
    ? validateStatus(client.clnteestado, EMPTY_CLIENT_STATUS_MESSAGE, INVALID_CLIENT_UPDATE_STATUS_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const clientDB = await findClientById({
      clnteemid: user.usemid,
      clnteid,
    });

    if (!clientDB) {
      throw new Error('Cliente no encontrado');
    }

    if (clientDB.clnteestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_CLIENT_MESSAGE);
    }

    const nextIdentificationType = clntetipoidentificacion ?? clientDB.clntetipoidentificacion;
    const nextIdentificationRaw = client.clnteidentificacion ?? clientDB.clnteidentificacion;
    const nextIdentification = validateIdentificationByType(
      nextIdentificationRaw,
      nextIdentificationType,
      EMPTY_CLIENT_IDENTIFICATION_MESSAGE,
      INVALID_CLIENT_IDENTIFICATION_MESSAGE,
    );

    if (nextIdentification !== clientDB.clnteidentificacion) {
      const clientByIdentificationDB = await findClientByIdentification({
        clnteemid: user.usemid,
        clnteidentificacion: nextIdentification,
      });

      if (clientByIdentificationDB && clientByIdentificationDB.clnteid !== clnteid) {
        throw new Error(INVALID_CLIENT_EXISTS_IDENTIFICATION_MESSAGE);
      }
    }

    if (clntecorreo !== undefined && clntecorreo !== null && clntecorreo !== clientDB.clntecorreo) {
      const clientByEmailDB = await findClientByEmail({
        clnteemid: user.usemid,
        clntecorreo,
      });

      if (clientByEmailDB && clientByEmailDB.clnteid !== clnteid) {
        throw new Error(INVALID_CLIENT_EXISTS_EMAIL_MESSAGE);
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    if (clntetipoidentificacion !== undefined && clntetipoidentificacion !== clientDB.clntetipoidentificacion) {
      dataDB.push({ column: 'clntetipoidentificacion', value: clntetipoidentificacion });
    }

    if (nextIdentification !== clientDB.clnteidentificacion) {
      dataDB.push({ column: 'clnteidentificacion', value: nextIdentification });
    }

    if (clntenombre !== undefined && clntenombre !== clientDB.clntenombre) {
      dataDB.push({ column: 'clntenombre', value: clntenombre });
    }

    if (clntecorreo !== undefined && clntecorreo !== clientDB.clntecorreo) {
      dataDB.push({ column: 'clntecorreo', value: clntecorreo });
    }

    if (clntedireccion !== undefined && clntedireccion !== clientDB.clntedireccion) {
      dataDB.push({ column: 'clntedireccion', value: clntedireccion });
    }

    if (clntetelefono !== undefined && clntetelefono !== clientDB.clntetelefono) {
      dataDB.push({ column: 'clntetelefono', value: clntetelefono });
    }

    if (clnteestado !== undefined && clnteestado !== clientDB.clnteestado) {
      dataDB.push({ column: 'clnteestado', value: clnteestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_CLIENT_MESSAGE);
    }

    const updatedClientDB = await updateClientById(dataDB, {
      clnteemid: user.usemid,
      clnteid,
    });

    if (!updatedClientDB) {
      return null;
    }

    return updatedClientDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        clientId: clnteid,
        hasIdentificationType: clntetipoidentificacion !== undefined,
        hasIdentification: client.clnteidentificacion !== undefined,
        hasName: clntenombre !== undefined,
        hasEmail: clntecorreo !== undefined,
        hasAddress: clntedireccion !== undefined,
        hasPhone: clntetelefono !== undefined,
        hasStatus: clnteestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating client',
    );
    throw error;
  }
}

export { createClient, readClient, readClients, updateClient, validateCompanyAndUserAccess };
