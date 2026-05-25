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


const EMPTY_COMPANY_ID_MESSAGE = 'Company id is required';
const EMPTY_NAME_MESSAGE = 'Name is required';
const EMPTY_NICKNAME_MESSAGE = 'Nickname is required';
const EMPTY_EMAIL_MESSAGE = 'Email is required';
const EMPTY_PASSWORD_MESSAGE = 'Password is required';
const EMPTY_ROLE_MESSAGE = 'Role is required';
const INVALID_EMAIL_MESSAGE = 'Email must be valid';
const INVALID_NAME_MESSAGE = 'Name must contain only letters and spaces';
const INVALID_PASSWORD_MESSAGE = 'Password must be at least 8 characters';
const INVALID_ROLE_MESSAGE = 'Role must be valid';
const INVALID_ROLE_MESSAGE_USER = 'Role must be jefe or empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'Company is not parent';
const INVALID_COMPANY_FIND_MESSAGE = 'Company code is not invalid';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'User is not admin';
const FORBIDDEN_ROL_USER_MESSAGE = 'User is not jefe, empleado or admin';
const INVALID_USER_STATUS_MESSAGE = 'User is not active';
const INVALID_USER_NOT_FOUND_MESSAGE = 'User does not exist';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'User does not belong to the company';
const INVALID_COMPANY_STATUS_MESSAGE = 'Company is not active';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'User cannot access another company';
const FORBIDDEN_ROLE_USER_JEFE_MESSAGE = 'User is not jefe';
const INVALID_PAGE_MESSAGE = 'Page must be a positive integer';
const INVALID_PAGE_SIZE_MESSAGE = 'Page size must be a positive integer';
const EMPTY_USER_ID_MESSAGE = 'User id is required';
const EMPTY_USER_STATUS_MESSAGE = 'User status is required';
const EMPTY_USER_IMAGE_MESSAGE = 'User image is required';
const INVALID_USER_UPDATE_STATUS_MESSAGE = 'User status must be activo, inactivo or eliminado';
const EMPTY_UPDATE_USER_MESSAGE = 'At least one field is required to update user';
const FORBIDDEN_UPDATE_DELETED_USER_MESSAGE = 'Deleted user status cannot be changed';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function validateFindUsersParams(params: FindUsersParamsDto): FindUsersParamsDto {
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
      throw new Error('Company does not exist');
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
      throw new Error('User already exists with that email');
    }

    const apodoDB = await findUserByNickname({
      usemid,
      usapodo,
    });
    if (apodoDB) {
      throw new Error('User already exists with that nickname');
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
      throw new Error('User was not created');
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
      throw new Error('User not found');
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
      throw new Error('User not found');
    }

    if (userDB.usestado === 'eliminado') {
      throw new Error('Deleted user cannot be updated');
    }

    if (uscorreo) {
      const emailDB = await findUserByEmail(uscorreo);
      if (emailDB) {
        throw new Error('User already exists with that email');
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
      throw new Error('Error updating user');
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

export { createUser, readUsers, readUser, updateUserWithStatus, updateUser };
