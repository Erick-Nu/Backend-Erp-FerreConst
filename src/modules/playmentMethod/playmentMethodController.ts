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
      res.status(400).json({ message: 'La busqueda debe ser un texto' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser un texto' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidStatus(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser activo o inactivo' });
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
      res.status(400).json({ message: 'El id de método de pago es requerido' });
      return;
    }

    const playmentMethod: FindPlaymentMethodDto = {
      mpid: id,
    };
    const user: LoginUserDto = req.auth!;

    const playmentMethodDB = await readPlaymentMethod(playmentMethod, user);
    if (!playmentMethodDB) {
      res.status(404).json({ message: 'Metodo de pago no encontrado' });
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
      res.status(400).json({ message: 'El id de método de pago es requerido' });
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
      res.status(404).json({ message: 'Metodo de pago no encontrado' });
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
