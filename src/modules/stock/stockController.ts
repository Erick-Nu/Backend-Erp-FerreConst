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
import { isValidStatus } from '../../utils/validation.js';

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

    if (typeof stcksuid === 'string' && stcksuid.trim().length > 0) {
      resolvedBranchId = stcksuid;
    } else if (typeof suidentificador === 'string' && suidentificador.trim().length > 0) {
      const branchId = await findBranchByIdentifier({
        suemid: user.usemid,
        suidentificador: suidentificador.trim(),
      });

      if (!branchId) {
        res.status(404).json({ message: 'Branch not found' });
        return;
      }

      resolvedBranchId = branchId;
    }

    if (!resolvedBranchId) {
      res.status(400).json({ message: 'Stock branch id or branch identifier is required' });
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

    if (typeof statusQuery === 'string' && isValidStatus(statusQuery)) {
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
    const user: LoginUserDto = req.auth!;

    const params: FindStocksByCompanyParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidStatus(statusQuery)) {
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
      res.status(400).json({ message: 'Stock id is required' });
      return;
    }

    const stock: FindStockDto = {
      stckid: id,
    };
    const user: LoginUserDto = req.auth!;

    const stockDB = await readStock(stock, user);
    if (!stockDB) {
      res.status(404).json({ message: 'Stock not found' });
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
      res.status(400).json({ message: 'Stock id is required' });
      return;
    }

    const body: UpdateStockRequestBody = req.body;
    const { stcksuid, stckcantidad, stckestado } = body;

    if (typeof stcksuid !== 'string') {
      res.status(400).json({ message: 'Stock branch id is required' });
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
      res.status(404).json({ message: 'Stock not found' });
      return;
    }

    res.status(200).json(updatedStock);
  } catch (error) {
    next(error);
  }
};

export { registerStock, searchStocks, searchStocksByCompany, searchStock, updateStockData };
