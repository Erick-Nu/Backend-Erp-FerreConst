import type { LoginUserDto } from '../auth/authDto.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import { validateRequiredString } from '../../utils/validation.js';
import type {
  ConfigResponseDto,
  CreateConfigDto,
  FindConfigByKeyDto,
  FindConfigsResponseDto,
  UpdateConfigDto,
} from './configDto.js';
import {
  deleteConfigByKey,
  findConfigByKey,
  findConfigs,
  saveConfig,
  updateConfigByKey,
} from './configDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'Company id is required';
const EMPTY_CONFIG_KEY_MESSAGE = 'Config key is required';
const EMPTY_CONFIG_VALUE_MESSAGE = 'Config value is required';
const INVALID_COMPANY_FIND_MESSAGE = 'Company does not exist';
const INVALID_COMPANY_STATUS_MESSAGE = 'Company is not active';
const INVALID_USER_NOT_FOUND_MESSAGE = 'User does not exist';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'User does not belong to the company';
const INVALID_USER_STATUS_MESSAGE = 'User is not active';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'User is not admin';
const FORBIDDEN_ROL_USER_MESSAGE = 'User is not jefe, empleado or admin';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'Company is not parent';
const INVALID_CONFIG_EXISTS_MESSAGE = 'Config already exists with that key';
const EMPTY_UPDATE_CONFIG_MESSAGE = 'At least one field is required to update config';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
};

async function validateCompanyAndUserAccess(user: LoginUserDto, options: AccessOptions): Promise<void> {
  const { requireParentCompany, requireAdminUser } = options;

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

async function createConfig(config: CreateConfigDto, user: LoginUserDto): Promise<ConfigResponseDto> {
  const cfemid = validateRequiredString(config.cfemid, EMPTY_COMPANY_ID_MESSAGE);
  const cfclave = validateRequiredString(config.cfclave, EMPTY_CONFIG_KEY_MESSAGE);
  const cfvalor = validateRequiredString(config.cfvalor, EMPTY_CONFIG_VALUE_MESSAGE);

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    };

    await validateCompanyAndUserAccess(user, access);

    const configByKeyDB = await findConfigByKey({
      cfemid,
      cfclave,
    });

    if (configByKeyDB) {
      throw new Error(INVALID_CONFIG_EXISTS_MESSAGE);
    }

    await saveConfig({
      cfemid,
      cfclave,
      cfvalor,
    });

    const newConfig = await findConfigByKey({
      cfemid,
      cfclave,
    });

    return newConfig!;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: cfemid,
        key: cfclave,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating config',
    );
    throw error;
  }
}

async function readConfig(
  config: FindConfigByKeyDto,
  user: LoginUserDto,
  companyId?: string,
): Promise<ConfigResponseDto | null> {
  const cfemid = companyId !== undefined
    ? validateRequiredString(companyId, EMPTY_COMPANY_ID_MESSAGE)
    : user.usemid;
  const cfclave = validateRequiredString(config.cfclave, EMPTY_CONFIG_KEY_MESSAGE);

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    };

    await validateCompanyAndUserAccess(user, access);

    const configDB = await findConfigByKey({
      cfemid,
      cfclave,
    });

    if (!configDB) {
      throw new Error('Config not found');
    }

    return configDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: cfemid,
        key: cfclave,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading config',
    );
    throw error;
  }
}

async function readConfigByKey(
  config: FindConfigByKeyDto,
  user: LoginUserDto,
): Promise<ConfigResponseDto | null> {
  const cfclave = validateRequiredString(config.cfclave, EMPTY_CONFIG_KEY_MESSAGE);

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    };

    await validateCompanyAndUserAccess(user, access);

    const configDB = await findConfigByKey({
      cfemid: user.usemid,
      cfclave,
    });

    if (!configDB) {
      throw new Error('Config not found');
    }

    return configDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        key: cfclave,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading config by key',
    );
    throw error;
  }
}

async function readConfigs(user: LoginUserDto, companyId?: string): Promise<FindConfigsResponseDto> {
  const cfemid = companyId !== undefined
    ? validateRequiredString(companyId, EMPTY_COMPANY_ID_MESSAGE)
    : user.usemid;

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    };

    await validateCompanyAndUserAccess(user, access);

    const configsDB = await findConfigs(cfemid);

    return configsDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: cfemid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading configs',
    );
    throw error;
  }
}

async function updateConfig(
  config: UpdateConfigDto,
  user: LoginUserDto,
  companyId?: string,
): Promise<ConfigResponseDto | null> {
  const cfemid = companyId !== undefined
    ? validateRequiredString(companyId, EMPTY_COMPANY_ID_MESSAGE)
    : user.usemid;
  const cfclave = validateRequiredString(config.cfclave, EMPTY_CONFIG_KEY_MESSAGE);
  const cfvalor = validateRequiredString(config.cfvalor, EMPTY_CONFIG_VALUE_MESSAGE);

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    };

    await validateCompanyAndUserAccess(user, access);

    const configDB = await findConfigByKey({
      cfemid,
      cfclave,
    });

    if (!configDB) {
      return null;
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date;
    }[] = [];

    if (cfvalor !== configDB.cfvalor) {
      dataDB.push({ column: 'cfvalor', value: cfvalor });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_CONFIG_MESSAGE);
    }

    const updatedConfigDB = await updateConfigByKey(dataDB, {
      cfemid,
      cfclave,
    });

    if (!updatedConfigDB) {
      return null;
    }

    return updatedConfigDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: cfemid,
        key: cfclave,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating config',
    );
    throw error;
  }
}

async function deleteConfig(
  config: FindConfigByKeyDto,
  user: LoginUserDto,
  companyId?: string,
): Promise<ConfigResponseDto | null> {
  const cfemid = companyId !== undefined
    ? validateRequiredString(companyId, EMPTY_COMPANY_ID_MESSAGE)
    : user.usemid;
  const cfclave = validateRequiredString(config.cfclave, EMPTY_CONFIG_KEY_MESSAGE);

  try {
    const access = {
      requireParentCompany: true,
      requireAdminUser: true,
    };

    await validateCompanyAndUserAccess(user, access);

    const deletedConfigDB = await deleteConfigByKey({
      cfemid,
      cfclave,
    });

    if (!deletedConfigDB) {
      return null;
    }

    return deletedConfigDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: cfemid,
        key: cfclave,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error deleting config',
    );
    throw error;
  }
}

export { createConfig, readConfig, readConfigByKey, readConfigs, updateConfig, deleteConfig };
