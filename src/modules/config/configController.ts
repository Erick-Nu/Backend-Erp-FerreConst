import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateConfigDto,
  FindConfigByKeyDto,
  UpdateConfigDto,
} from './configDto.js';
import { createConfig, deleteConfig, readConfig, readConfigs, updateConfig } from './configService.js';

type UpdateConfigRequestBody = Pick<UpdateConfigDto, 'cfvalor'>;

const registerConfig: RequestHandler = async (req, res, next) => {
  try {
    const { cfemid, cfclave, cfvalor } = req.body;
    const config: CreateConfigDto = {
      cfemid,
      cfclave,
      cfvalor,
    };
    const user: LoginUserDto = req.auth!;

    const configDB = await createConfig(config, user);

    res.status(201).json(configDB);
  } catch (error) {
    next(error);
  }
};

const searchConfigs: RequestHandler = async (req, res, next) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const user: LoginUserDto = req.auth!;
    const configsDB = await readConfigs(user, companyId);

    res.status(200).json(configsDB);
  } catch (error) {
    next(error);
  }
};

const searchConfig: RequestHandler = async (req, res, next) => {
  try {
    const { configKey } = req.params;
    if (typeof configKey !== 'string') {
      res.status(400).json({ message: 'Config key is required' });
      return;
    }
    const { companyId } = req.query;
    if (typeof companyId !== 'string') {
      res.status(400).json({ message: 'Company id is required' });
      return;
    }

    const config: FindConfigByKeyDto = {
      cfclave: configKey,
    };
    const user: LoginUserDto = req.auth!;

    const configDB = await readConfig(config, user, companyId);
    if (!configDB) {
      res.status(404).json({ message: 'Config not found' });
      return;
    }

    res.status(200).json(configDB);
  } catch (error) {
    next(error);
  }
};

const updateConfigData: RequestHandler = async (req, res, next) => {
  try {
    const { configKey } = req.params;
    if (typeof configKey !== 'string') {
      res.status(400).json({ message: 'Config key is required' });
      return;
    }
    const { companyId } = req.query;
    if (typeof companyId !== 'string') {
      res.status(400).json({ message: 'Company id is required' });
      return;
    }

    const body: UpdateConfigRequestBody = req.body;
    const { cfvalor } = body;
    const config: UpdateConfigDto = {
      cfclave: configKey,
      cfvalor,
    };

    const user: LoginUserDto = req.auth!;
    const updatedConfig = await updateConfig(config, user, companyId);
    if (!updatedConfig) {
      res.status(404).json({ message: 'Config not found' });
      return;
    }

    res.status(200).json(updatedConfig);
  } catch (error) {
    next(error);
  }
};

const deleteConfigData: RequestHandler = async (req, res, next) => {
  try {
    const { configKey } = req.params;
    if (typeof configKey !== 'string') {
      res.status(400).json({ message: 'Config key is required' });
      return;
    }
    const { companyId } = req.query;
    if (typeof companyId !== 'string') {
      res.status(400).json({ message: 'Company id is required' });
      return;
    }

    const config: FindConfigByKeyDto = {
      cfclave: configKey,
    };
    const user: LoginUserDto = req.auth!;
    const deletedConfig = await deleteConfig(config, user, companyId);
    if (!deletedConfig) {
      res.status(404).json({ message: 'Config not found' });
      return;
    }

    res.status(200).json({ cfclave: deletedConfig.cfclave });
  } catch (error) {
    next(error);
  }
};

export {
  deleteConfigData,
  registerConfig,
  searchConfig,
  searchConfigs,
  updateConfigData,
};
