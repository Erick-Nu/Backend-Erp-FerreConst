import type { LoginUserDto } from '../auth/authDto.js';
import { findBranchById } from '../branch/branchDao.js';
import { findCompanyById } from '../company/companyDao.js';
import { findProductById } from '../product/productDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import { validateNumber, validateRequiredString, validateStatus } from '../../utils/validation.js';
import type {
  CreateStockDto,
  FindStocksByCompanyParamsDto,
  FindStockDto,
  FindStocksParamsDto,
  FindStocksResponseDto,
  StockResponseDto,
  UpdateStockDto,
} from './stockDto.js';
import {
  findStockById,
  findStockByProductId,
  findStocks,
  findStocksByCompany,
  saveStock,
  updateStockById,
} from './stockDao.js';
import type { FindStocksResponseDao, StockRowDao } from './stockDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'Company id is required';
const EMPTY_STOCK_ID_MESSAGE = 'Stock id is required';
const EMPTY_STOCK_BRANCH_ID_MESSAGE = 'Stock branch id is required';
const EMPTY_STOCK_PRODUCT_ID_MESSAGE = 'Stock product id is required';
const EMPTY_STOCK_STATUS_MESSAGE = 'Stock status is required';
const INVALID_STOCK_UPDATE_STATUS_MESSAGE = 'Stock status must be activo, inactivo or eliminado';
const INVALID_COMPANY_FIND_MESSAGE = 'Company does not exist';
const INVALID_COMPANY_STATUS_MESSAGE = 'Company is not active';
const INVALID_USER_NOT_FOUND_MESSAGE = 'User does not exist';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'User does not belong to the company';
const INVALID_USER_STATUS_MESSAGE = 'User is not active';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'User is not admin';
const FORBIDDEN_ROL_USER_MESSAGE = 'User is not jefe, empleado or admin';
const FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE = 'User is not jefe or empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'Company is not parent';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'User cannot access another company';
const INVALID_PAGE_MESSAGE = 'Page must be a positive integer';
const INVALID_PAGE_SIZE_MESSAGE = 'Page size must be a positive integer';
const INVALID_STOCK_BRANCH_NOT_FOUND_MESSAGE = 'Stock branch does not exist';
const INVALID_STOCK_PRODUCT_NOT_FOUND_MESSAGE = 'Stock product does not exist';
const INVALID_STOCK_EXISTS_MESSAGE = 'Stock already exists for this branch and product';
const EMPTY_UPDATE_STOCK_MESSAGE = 'At least one field is required to update stock';
const FORBIDDEN_UPDATE_DELETED_STOCK_MESSAGE = 'Deleted stock cannot be updated';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

function mapStockRowToResponse(stock: StockRowDao): StockResponseDto {
  return {
    stckid: stock.stckid,
    stckemid: stock.stckemid,
    sucursal: {
      suid: stock.stcksuid,
      sunombre: stock.sunombre ?? null,
      suidentificador: stock.suidentificador ?? null,
    },
    producto: {
      prdtoid: stock.stckprdtoid,
      prdtocodigo: stock.prdtocodigo ?? null,
      prdtonombre: stock.prdtonombre ?? null,
    },
    stckcantidad: stock.stckcantidad,
    stckfchregistro: stock.stckfchregistro,
    stckfchactualizacion: stock.stckfchactualizacion,
    stckestado: stock.stckestado,
  };
}

function mapFindStocksResponse(stocksDB: FindStocksResponseDao): FindStocksResponseDto {
  return {
    ...stocksDB,
    items: stocksDB.items.map(mapStockRowToResponse),
  };
}

function validateFindStocksParams(params: FindStocksParamsDto): FindStocksParamsDto {
  const { stcksuid, page, pageSize } = params;
  const validatedBranchId = validateRequiredString(stcksuid, EMPTY_STOCK_BRANCH_ID_MESSAGE);

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(INVALID_PAGE_MESSAGE);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(INVALID_PAGE_SIZE_MESSAGE);
  }

  return {
    stcksuid: validatedBranchId,
    page,
    pageSize,
  };
}

function validateFindStocksByCompanyParams(
  params: FindStocksByCompanyParamsDto,
): FindStocksByCompanyParamsDto {
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

async function validateBranchAndProductExistence(
  companyId: string,
  branchId: string,
  productId?: string,
): Promise<void> {
  const branchDB = await findBranchById({
    suemid: companyId,
    suid: branchId,
  });

  if (!branchDB) {
    throw new Error(INVALID_STOCK_BRANCH_NOT_FOUND_MESSAGE);
  }

  if (productId !== undefined) {
    const productDB = await findProductById({
      prdtoemid: companyId,
      prdtoid: productId,
    });

    if (!productDB) {
      throw new Error(INVALID_STOCK_PRODUCT_NOT_FOUND_MESSAGE);
    }
  }
}

async function createStock(stock: CreateStockDto, user: LoginUserDto): Promise<StockResponseDto> {
  const stckemid = validateRequiredString(stock.stckemid, EMPTY_COMPANY_ID_MESSAGE);
  const stcksuid = validateRequiredString(stock.stcksuid, EMPTY_STOCK_BRANCH_ID_MESSAGE);
  const stckprdtoid = validateRequiredString(stock.stckprdtoid, EMPTY_STOCK_PRODUCT_ID_MESSAGE);
  const stckcantidad = validateNumber(stock.stckcantidad);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: stckemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);
    await validateBranchAndProductExistence(stckemid, stcksuid, stckprdtoid);

    const stockByProductDB = await findStockByProductId({
      stckemid,
      stcksuid,
      stckprdtoid,
    });

    if (stockByProductDB) {
      throw new Error(INVALID_STOCK_EXISTS_MESSAGE);
    }

    const stockId = await saveStock({
      stckemid,
      stcksuid,
      stckprdtoid,
      stckcantidad,
    });

    const stockDB = await findStockById({
      stckemid,
      stckid: stockId,
    });

    if (!stockDB) {
      throw new Error('Stock was not created');
    }

    return mapStockRowToResponse(stockDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: stckemid,
        branchId: stcksuid,
        productId: stckprdtoid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating stock',
    );
    throw error;
  }
}

async function readStock(stock: FindStockDto, user: LoginUserDto): Promise<StockResponseDto | null> {
  const stckid = validateRequiredString(stock.stckid, EMPTY_STOCK_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const stockDB = await findStockById({
      stckemid: user.usemid,
      stckid,
    });

    if (!stockDB) {
      throw new Error('Stock not found');
    }

    return mapStockRowToResponse(stockDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        stockId: stckid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading stock',
    );
    throw error;
  }
}

async function readStocks(
  params: FindStocksParamsDto,
  user: LoginUserDto,
): Promise<FindStocksResponseDto> {
  const validatedParams = validateFindStocksParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);
    await validateBranchAndProductExistence(user.usemid, validatedParams.stcksuid);

    const stocksDB = await findStocks(validatedParams, user.usemid, validatedParams.stcksuid);

    return mapFindStocksResponse(stocksDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        branchId: validatedParams.stcksuid,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading stocks',
    );
    throw error;
  }
}

async function readStocksByCompany(
  params: FindStocksByCompanyParamsDto,
  user: LoginUserDto,
): Promise<FindStocksResponseDto> {
  const validatedParams = validateFindStocksByCompanyParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const stocksDB = await findStocksByCompany(validatedParams, user.usemid);

    return mapFindStocksResponse(stocksDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading stocks by company',
    );
    throw error;
  }
}

async function updateStock(stock: UpdateStockDto, user: LoginUserDto): Promise<StockResponseDto | null> {
  const stckid = validateRequiredString(stock.stckid, EMPTY_STOCK_ID_MESSAGE);
  const stcksuid = validateRequiredString(stock.stcksuid, EMPTY_STOCK_BRANCH_ID_MESSAGE);
  const stckcantidad = stock.stckcantidad !== undefined
    ? validateNumber(stock.stckcantidad)
    : undefined;
  const stckestado = stock.stckestado !== undefined
    ? validateStatus(stock.stckestado, EMPTY_STOCK_STATUS_MESSAGE, INVALID_STOCK_UPDATE_STATUS_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);
    await validateBranchAndProductExistence(user.usemid, stcksuid);

    const stockDB = await findStockById({
      stckemid: user.usemid,
      stckid,
    });

    if (!stockDB) {
      throw new Error('Stock not found');
    }

    if (stockDB.stcksuid !== stcksuid) {
      throw new Error('Stock not found');
    }

    if (stockDB.stckestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_STOCK_MESSAGE);
    }

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    if (stckcantidad !== undefined && stckcantidad !== stockDB.stckcantidad) {
      dataDB.push({ column: 'stckcantidad', value: stckcantidad });
    }

    if (stckestado !== undefined && stckestado !== stockDB.stckestado) {
      dataDB.push({ column: 'stckestado', value: stckestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_STOCK_MESSAGE);
    }

    dataDB.push({ column: 'stckfchactualizacion', value: new Date() });

    const updatedStockDB = await updateStockById(dataDB, {
      stckemid: user.usemid,
      stcksuid,
      stckid,
    });

    if (!updatedStockDB) {
      return null;
    }

    const stockUpdatedWithRelationsDB = await findStockById({
      stckemid: user.usemid,
      stckid,
    });

    if (!stockUpdatedWithRelationsDB) {
      return null;
    }

    return mapStockRowToResponse(stockUpdatedWithRelationsDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        stockId: stckid,
        branchId: stcksuid,
        hasQuantity: stckcantidad !== undefined,
        hasStatus: stckestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating stock',
    );
    throw error;
  }
}

export {
  createStock,
  readStock,
  readStocks,
  readStocksByCompany,
  updateStock,
  validateCompanyAndUserAccess,
};
