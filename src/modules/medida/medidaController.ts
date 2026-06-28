import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateMedidaDto,
  FindMedidaDto,
  FindMedidasParamsDto,
  UpdateMedidaDto,
} from './medidaDto.js';
import {
  createMedida,
  readMedida,
  readMedidas,
  updateMedida,
} from './medidaService.js';
import { isValidFilterStatus } from '../../utils/validation.js';

type UpdateMedidaRequestBody = Omit<UpdateMedidaDto, 'mdiaid'>;

const registerMedida: RequestHandler = async (req, res, next) => {
  try {
    const { mdiaemid, mdianombre, mdiaabreviatura } = req.body;
    const medida: CreateMedidaDto = {
      mdiaemid,
      mdianombre,
      mdiaabreviatura,
    };
    const user: LoginUserDto = req.auth!;

    const medidaDB = await createMedida(medida, user);

    res.status(201).json(medidaDB);
  } catch (error) {
    next(error);
  }
};

const searchMedidas: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'La búsqueda debe ser un texto' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser un texto' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidFilterStatus(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser activo o inactivo' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindMedidasParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidFilterStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const user: LoginUserDto = req.auth!;
    const medidasDB = await readMedidas(params, user);

    res.status(200).json(medidasDB);
  } catch (error) {
    next(error);
  }
};

const searchMedida: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de medida es requerido' });
      return;
    }

    const medida: FindMedidaDto = {
      mdiaid: id,
    };
    const user: LoginUserDto = req.auth!;

    const medidaDB = await readMedida(medida, user);
    if (!medidaDB) {
      res.status(404).json({ message: 'Medida no encontrada' });
      return;
    }

    res.status(200).json(medidaDB);
  } catch (error) {
    next(error);
  }
};

const updateMedidaData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de medida es requerido' });
      return;
    }

    const body: UpdateMedidaRequestBody = req.body;
    const { mdianombre, mdiaabreviatura, mdiaestado } = body;
    const medida: UpdateMedidaDto = {
      mdiaid: id,
    };

    if (mdianombre !== undefined) {
      medida.mdianombre = mdianombre;
    }

    if (mdiaabreviatura !== undefined) {
      medida.mdiaabreviatura = mdiaabreviatura;
    }

    if (mdiaestado !== undefined) {
      medida.mdiaestado = mdiaestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedMedida = await updateMedida(medida, user);
    if (!updatedMedida) {
      res.status(404).json({ message: 'Medida no encontrada' });
      return;
    }

    res.status(200).json(updatedMedida);
  } catch (error) {
    next(error);
  }
};

export { registerMedida, searchMedidas, searchMedida, updateMedidaData };
