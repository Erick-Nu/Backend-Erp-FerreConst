import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateStockDto,
  FindStocksByCompanyParamsDto,
  FindStockDto,
  FindStocksParamsDto,
  UpdateStockDto,
} from './stockDto.js';
import { findBranchByIdentifier } from '../branch/branchDao.js';
import {
  createStock,
  readStock,
  readStocks,
  readStocksByCompany,
  updateStock,
} from './stockService.js';
import { isValidFilterStatus } from '../../utils/validation.js';

type UpdateStockRequestBody = Omit<UpdateStockDto, 'stckid'>;

const registerStock: RequestHandler = async (req, res, next) => {
  try {
    const { stckemid, stcksuid, stckprdtoid, stckcantidad } = req.body;
    const stock: CreateStockDto = {
      stckemid,
      stcksuid,
      stckprdtoid,
      stckcantidad,
    };
    const user: LoginUserDto = req.auth!;

    const stockDB = await createStock(stock, user);

    res.status(201).json(stockDB);
  } catch (error) {
    next(error);
  }
};

const searchStocks: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;
    const { stcksuid, suidentificador } = req.query;
    const user: LoginUserDto = req.auth!;
    let resolvedBranchId: string | null = null;

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

    if (typeof stcksuid === 'string' && stcksuid.trim().length > 0) {
      resolvedBranchId = stcksuid;
    } else if (typeof suidentificador === 'string' && suidentificador.trim().length > 0) {
      const branchId = await findBranchByIdentifier({
        suemid: user.usemid,
        suidentificador: suidentificador.trim(),
      });

      if (!branchId) {
        res.status(404).json({ message: 'Sucursal no encontrada' });
        return;
      }

      resolvedBranchId = branchId;
    }

    if (!resolvedBranchId) {
      res.status(400).json({ message: 'El id de sucursal o identificador de sucursal es requerido' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindStocksParamsDto = {
      stcksuid: resolvedBranchId,
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidFilterStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const stocksDB = await readStocks(params, user);

    res.status(200).json(stocksDB);
  } catch (error) {
    next(error);
  }
};

const searchStocksByCompany: RequestHandler = async (req, res, next) => {
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
    const user: LoginUserDto = req.auth!;

    const params: FindStocksByCompanyParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidFilterStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const stocksDB = await readStocksByCompany(params, user);

    res.status(200).json(stocksDB);
  } catch (error) {
    next(error);
  }
};

const searchStock: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de stock es requerido' });
      return;
    }

    const stock: FindStockDto = {
      stckid: id,
    };
    const user: LoginUserDto = req.auth!;

    const stockDB = await readStock(stock, user);
    if (!stockDB) {
      res.status(404).json({ message: 'Stock no encontrado' });
      return;
    }

    res.status(200).json(stockDB);
  } catch (error) {
    next(error);
  }
};

const updateStockData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de stock es requerido' });
      return;
    }

    const body: UpdateStockRequestBody = req.body;
    const { stcksuid, stckcantidad, stckestado } = body;

    if (typeof stcksuid !== 'string') {
      res.status(400).json({ message: 'El id de sucursal de stock es requerido' });
      return;
    }

    const stock: UpdateStockDto = {
      stckid: id,
      stcksuid,
    };

    if (stckcantidad !== undefined) {
      stock.stckcantidad = stckcantidad;
    }

    if (stckestado !== undefined) {
      stock.stckestado = stckestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedStock = await updateStock(stock, user);
    if (!updatedStock) {
      res.status(404).json({ message: 'Stock no encontrado' });
      return;
    }

    res.status(200).json(updatedStock);
  } catch (error) {
    next(error);
  }
};

export { registerStock, searchStocks, searchStocksByCompany, searchStock, updateStockData };
