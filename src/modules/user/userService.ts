import {
  saveUser,
  findUserByEmail,
  findUserByNickname,
  findUserById,
  findUsers,
  updateUserById,
  updateUserStatus,
} from './userDao.js';
import type {
  CreateUserDto,
  FindUserDto,
  FindUsersParamsDto,
  FindUsersResponseDto,
  UpdateUserDto,
  UpdateUserPasswordDto,
  UpdateStatusUserDto,
  UserResponseDto,
} from './userDto.js';
import type { LoginUserDto } from '../auth/authDto.js';
import { encryptPassword } from '../../utils/bcrypt.js';
import { logger } from '../../utils/logger.js';
import { toPublicImageUrl } from '../../middlewares/uploadImage.js';
import {
  validateEmail,
  validateName,
  validatePassword,
  validateRequiredString,
  validateRole,
  validateStatus,
} from '../../utils/validation.js';
import { findCompanyById } from  '../company/companyDao.js';


const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_NAME_MESSAGE = 'El nombre es requerido';
const EMPTY_NICKNAME_MESSAGE = 'El apodo es requerido';
const EMPTY_EMAIL_MESSAGE = 'El correo es requerido';
const EMPTY_PASSWORD_MESSAGE = 'La contraseña es requerida';
const EMPTY_ROLE_MESSAGE = 'El rol es requerido';
const INVALID_EMAIL_MESSAGE = 'El correo debe ser válido';
const INVALID_NAME_MESSAGE = 'El nombre solo debe contener letras y espacios';
const INVALID_PASSWORD_MESSAGE = 'La contraseña debe tener al menos 8 caracteres';
const INVALID_ROLE_MESSAGE = 'El rol debe ser válido';
const INVALID_ROLE_MESSAGE_USER = 'El rol debe ser jefe o empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es empresa padre';
const INVALID_COMPANY_FIND_MESSAGE = 'El código de empresa no es inválido';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no esta activo';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const FORBIDDEN_ROLE_USER_JEFE_MESSAGE = 'El usuario no es jefe';
const INVALID_PAGE_MESSAGE = 'La página debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamaño de página debe ser un entero positivo';
const EMPTY_USER_ID_MESSAGE = 'El id de usuario es requerido';
const EMPTY_USER_STATUS_MESSAGE = 'El estado de usuario es requerido';
const EMPTY_USER_IMAGE_MESSAGE = 'La imagen de usuario es requerida';
const INVALID_USER_UPDATE_STATUS_MESSAGE = 'El estado de usuario debe ser activo, inactivo o eliminado';
const EMPTY_UPDATE_USER_MESSAGE = 'Al menos un campo es requerido para actualizar el usuario';
const FORBIDDEN_UPDATE_DELETED_USER_MESSAGE = 'El usuario eliminado no puede cambiar de estado';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateFindUsersParams(params: FindUsersParamsDto): FindUsersParamsDto {
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

  const validatedParams: FindUsersParamsDto = {
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

async function createUser(user: CreateUserDto, userLogin: LoginUserDto): Promise<UserResponseDto> {
  const usemid = validateRequiredString(user.usemid, EMPTY_COMPANY_ID_MESSAGE);
  const usnombre = validateName(user.usnombre, EMPTY_NAME_MESSAGE, INVALID_NAME_MESSAGE);
  const usapodo = validateRequiredString(user.usapodo, EMPTY_NICKNAME_MESSAGE);
  const uscorreo = validateEmail(user.uscorreo, EMPTY_EMAIL_MESSAGE, INVALID_EMAIL_MESSAGE);
  const uspassword = validatePassword(user.uspassword, EMPTY_PASSWORD_MESSAGE, INVALID_PASSWORD_MESSAGE);
  const usimagen = user.usimagen;
  const usrol = validateRole(user.usrol, EMPTY_ROLE_MESSAGE, INVALID_ROLE_MESSAGE);

  try {
    const isCrossCompanyCreation = usemid !== userLogin.usemid;
    const access = isCrossCompanyCreation
      ? {
        requireParentCompany: true,
        requireAdminUser: true,
      }
      : {
        requireParentCompany: false,
        requireAdminUser: false,
        targetCompanyId: usemid,
      };

    await validateCompanyAndUserAccess(userLogin, access);

    const empresaDB = await findCompanyById(usemid);
    if (!empresaDB) {
      throw new Error('La empresa no existe');
    }

    if (!isCrossCompanyCreation) {
      const requesterUser = await findUserById({
        usid: userLogin.usid,
        usemid: userLogin.usemid,
      });
      if (!requesterUser) {
        throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
      }
      
      if (requesterUser.usemid !== empresaDB.emid) {
        throw new Error(FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE);
      }

      if (usrol === 'administrador') {
        throw new Error(INVALID_ROLE_MESSAGE_USER);
      }

      if (requesterUser.usrol !== 'jefe') {
        throw new Error(FORBIDDEN_ROLE_USER_JEFE_MESSAGE);
      }
    }

    const emailDB = await findUserByEmail(uscorreo);
    if (emailDB) {
      throw new Error('Ya existe un usuario con ese correo');
    }

    const apodoDB = await findUserByNickname({
      usemid,
      usapodo,
    });
    if (apodoDB) {
      throw new Error('Ya existe un usuario con ese apodo');
    }

    const passwordHash = await encryptPassword(uspassword);

    const userDB: CreateUserDto = {
      usemid,
      usnombre,
      usapodo,
      uscorreo,
      uspassword: passwordHash,
      usimagen,
      usrol,
    };

    const userId = await saveUser(userDB);
    const newUserDB = await findUserById({
      usid: userId,
      usemid,
    });

    if (!newUserDB) {
      throw new Error('El usuario no fue creado');
    }

    const userResponse: UserResponseDto = {
      ...newUserDB,
      usimagen: toPublicImageUrl(newUserDB.usimagen),
    };

    return userResponse;

  } catch(error) {
    logger.error({ err: error, companyId: usemid, email: uscorreo }, 'Error creating user');
    throw error;
  }
}

async function readUsers(params: FindUsersParamsDto, user: LoginUserDto): Promise<FindUsersResponseDto> {
  const validatedParams = validateFindUsersParams(params);
  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
    };

    await validateCompanyAndUserAccess(user, access);

    const usersDB = await findUsers(validatedParams, user.usemid);
    const usersResponse: FindUsersResponseDto = {
      ...usersDB,
      items: usersDB.items.map((userItem): UserResponseDto => ({
        ...userItem,
        usimagen: toPublicImageUrl(userItem.usimagen),
      })),
    };

    return usersResponse;
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
      'Error reading users',
    );
    throw error;
  }
}

async function readUser(userData: FindUserDto, user: LoginUserDto): Promise<UserResponseDto | null> {
  const validatedId = validateRequiredString(userData.usid, EMPTY_USER_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const userDB = await findUserById({
      usid: validatedId,
      usemid: user.usemid,
    });
    if (!userDB) {
      throw new Error('Usuario no encontrado');
    }

    const userResponse: UserResponseDto = {
      ...userDB,
      usimagen: toPublicImageUrl(userDB.usimagen),
    };

    return userResponse;
  } catch (error) {
    logger.error(
      {
        err: error,
        userId: validatedId,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading user',
    );
    throw error;
  }
}

async function updateUserWithStatus(userData: UpdateStatusUserDto, user: LoginUserDto): Promise<boolean> {
  const usid = validateRequiredString(userData.usid, EMPTY_USER_ID_MESSAGE);
  const usestado = validateStatus(userData.usestado, EMPTY_USER_STATUS_MESSAGE, INVALID_USER_UPDATE_STATUS_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const targetUser = await findUserById({
      usid,
      usemid: user.usemid,
    });
    
    if (!targetUser) {
      return false;
    }

    if (targetUser.usestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_USER_MESSAGE);
    }

    const updated = await updateUserStatus({
      usid,
      usemid: user.usemid,
      usestado,
    });

    return updated;

  } catch (error) {
    logger.error(
      {
        err: error,
        userId: usid,
        newStatus: usestado,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating user status',
    );
    throw error;
  }
}

async function updateUser(userData: UpdateUserDto, user: LoginUserDto): Promise<UserResponseDto | null> {
  const usid = validateRequiredString(userData.usid, EMPTY_USER_ID_MESSAGE);
  const usnombre = userData.usnombre !== undefined
    ? validateName(userData.usnombre, EMPTY_NAME_MESSAGE, INVALID_NAME_MESSAGE)
    : undefined;
  const uscorreo = userData.uscorreo !== undefined
    ? validateEmail(userData.uscorreo, EMPTY_EMAIL_MESSAGE, INVALID_EMAIL_MESSAGE)
    : undefined;
  const usimagen = userData.usimagen !== undefined
    ? validateRequiredString(userData.usimagen, EMPTY_USER_IMAGE_MESSAGE)
    : undefined;
  const usestado = userData.usestado !== undefined
    ? validateStatus(userData.usestado, EMPTY_USER_STATUS_MESSAGE, INVALID_USER_STATUS_MESSAGE)
    : undefined;
  const usrol = userData.usrol !== undefined
    ? validateRole(userData.usrol, EMPTY_ROLE_MESSAGE, INVALID_ROLE_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const userDB = await findUserById({
      usid,
      usemid: user.usemid,
    });

    if (!userDB) {
      throw new Error('Usuario no encontrado');
    }

    if (userDB.usestado === 'eliminado') {
      throw new Error('El usuario eliminado no puede ser actualizado');
    }

    if (uscorreo) {
      const emailDB = await findUserByEmail(uscorreo);
      if (emailDB) {
        throw new Error('Ya existe un usuario con ese correo');
      }
    }

    if (usrol || usestado !== undefined) {
      const requesterUser = await findUserById({
        usid: user.usid,
        usemid: user.usemid,
      });

      if (!requesterUser) {
        throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
      }

      if (requesterUser.usrol !== 'jefe') {
        throw new Error(FORBIDDEN_ROLE_USER_JEFE_MESSAGE);
      }

      if (!['jefe', 'empleado'].includes(userDB.usrol)) {
        throw new Error(INVALID_ROLE_MESSAGE_USER);
      }
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date;
    }[] = [];

    if (usnombre !== undefined && usnombre !== userDB.usnombre) {
      dataDB.push({ column: 'usnombre', value: usnombre });
    }

    if (uscorreo !== undefined && uscorreo !== userDB.uscorreo) {
      dataDB.push({ column: 'uscorreo', value: uscorreo });
    }

    if (usimagen !== undefined && usimagen !== userDB.usimagen) {
      dataDB.push({ column: 'usimagen', value: usimagen });
    }

    if (usrol) {
      dataDB.push({ column: 'usrol', value: usrol });
    }

    if (usestado !== undefined && usestado !== userDB.usestado) {
      dataDB.push({ column: 'usestado', value: usestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_USER_MESSAGE);
    }

    const updatedUserDB = await updateUserById(dataDB, {
      usid,
      usemid: user.usemid,
    });

    if (!updatedUserDB) {
      throw new Error('Error al actualizar el usuario');
    }

    const updatedUser: UserResponseDto = {
      ...updatedUserDB,
      usimagen: toPublicImageUrl(updatedUserDB.usimagen),
    };

    return updatedUser;
  } catch (error) {
    logger.error(
      {
        err: error,
        userId: usid,
        hasName: usnombre !== undefined,
        hasEmail: uscorreo !== undefined,
        hasImage: usimagen !== undefined,
        hasStatus: usestado !== undefined,
        hasRole: usrol !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating user',
    );
    throw error;
  }
}

async function updateUserPassword(userData: UpdateUserPasswordDto, user: LoginUserDto): Promise<boolean> {
  const usid = validateRequiredString(userData.usid, EMPTY_USER_ID_MESSAGE);
  const uspassword = validatePassword(userData.uspassword, EMPTY_PASSWORD_MESSAGE, INVALID_PASSWORD_MESSAGE);

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
      throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
    }

    if (requesterUser.usrol !== 'jefe') {
      throw new Error(FORBIDDEN_ROLE_USER_JEFE_MESSAGE);
    }

    const targetUser = await findUserById({
      usid,
      usemid: user.usemid,
    });

    if (!targetUser) {
      return false;
    }

    const passwordHash = await encryptPassword(uspassword);
    const updatedUserDB = await updateUserById(
      [{ column: 'uspassword', value: passwordHash }],
      { usid, usemid: user.usemid },
    );

    return updatedUserDB !== null;
  } catch (error) {
    logger.error(
      {
        err: error,
        userId: usid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating user password',
    );
    throw error;
  }
}

export { createUser, readUsers, readUser, updateUserWithStatus, updateUser, updateUserPassword };
