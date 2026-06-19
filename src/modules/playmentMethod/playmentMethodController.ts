import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreatePlaymentMethodDto,
  FindPlaymentMethodDto,
  FindPlaymentMethodsParamsDto,
  UpdatePlaymentMethodDto,
} from './playmentMethodDto.js';
import {
  createPlaymentMethod,
  readPlaymentMethod,
  readPlaymentMethods,
  updatePlaymentMethod,
} from './playmentMethodService.js';
import { isValidStatus } from '../../utils/validation.js';

type UpdatePlaymentMethodRequestBody = Omit<UpdatePlaymentMethodDto, 'mpid'>;

const registerPlaymentMethod: RequestHandler = async (req, res, next) => {
  try {
    const { mpemid, mpnombre } = req.body;
    const playmentMethod: CreatePlaymentMethodDto = {
      mpemid,
      mpnombre,
    };
    const user: LoginUserDto = req.auth!;

    const playmentMethodDB = await createPlaymentMethod(playmentMethod, user);

    res.status(201).json(playmentMethodDB);
  } catch (error) {
    next(error);
  }
};

const searchPlaymentMethods: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'Search must be a string' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'Status must be a string' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidStatus(statusQuery)) {
      res.status(400).json({ message: 'Status must be activo or inactivo' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindPlaymentMethodsParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const user: LoginUserDto = req.auth!;
    const playmentMethodsDB = await readPlaymentMethods(params, user);

    res.status(200).json(playmentMethodsDB);
  } catch (error) {
    next(error);
  }
};

const searchPlaymentMethod: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Playment method id is required' });
      return;
    }

    const playmentMethod: FindPlaymentMethodDto = {
      mpid: id,
    };
    const user: LoginUserDto = req.auth!;

    const playmentMethodDB = await readPlaymentMethod(playmentMethod, user);
    if (!playmentMethodDB) {
      res.status(404).json({ message: 'Playment method not found' });
      return;
    }

    res.status(200).json(playmentMethodDB);
  } catch (error) {
    next(error);
  }
};

const updatePlaymentMethodData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Playment method id is required' });
      return;
    }

    const body: UpdatePlaymentMethodRequestBody = req.body;
    const { mpnombre, mpestado } = body;
    const playmentMethod: UpdatePlaymentMethodDto = {
      mpid: id,
    };

    if (mpnombre !== undefined) {
      playmentMethod.mpnombre = mpnombre;
    }

    if (mpestado !== undefined) {
      playmentMethod.mpestado = mpestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedPlaymentMethod = await updatePlaymentMethod(playmentMethod, user);
    if (!updatedPlaymentMethod) {
      res.status(404).json({ message: 'Playment method not found' });
      return;
    }

    res.status(200).json(updatedPlaymentMethod);
  } catch (error) {
    next(error);
  }
};

export {
  registerPlaymentMethod,
  searchPlaymentMethod,
  searchPlaymentMethods,
  updatePlaymentMethodData,
};
