import type { LoginUserDto } from '../auth/authDto.js';
import {
  findLowStockProductByStock,
  hideAlertByStock,
  upsertAlert,
} from '../../agents/stockAlert/data/stockAlertDao.js';
import { findStockAlertCompanyAlertConfig } from '../../agents/stockAlert/data/stockAlertConfig.js';
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

const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_STOCK_ID_MESSAGE = 'El id de stock es requerido';
const EMPTY_STOCK_BRANCH_ID_MESSAGE = 'El id de sucursal de stock es requerido';
const EMPTY_STOCK_PRODUCT_ID_MESSAGE = 'El id de producto de stock es requerido';
const EMPTY_STOCK_STATUS_MESSAGE = 'El estado de stock es requerido';
const INVALID_STOCK_UPDATE_STATUS_MESSAGE = 'El estado de stock debe ser activo, inactivo o eliminado';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no esta activo';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE = 'El usuario no es jefe o empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es empresa padre';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const INVALID_PAGE_MESSAGE = 'La pagina debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamaño de pagina debe ser un entero positivo';
const INVALID_STOCK_BRANCH_NOT_FOUND_MESSAGE = 'La sucursal de stock no existe';
const INVALID_STOCK_PRODUCT_NOT_FOUND_MESSAGE = 'El producto de stock no existe';
const INVALID_STOCK_EXISTS_MESSAGE = 'Ya existe un stock para esta sucursal y producto';
const EMPTY_UPDATE_STOCK_MESSAGE = 'Al menos un campo es requerido para actualizar el stock';
const FORBIDDEN_UPDATE_DELETED_STOCK_MESSAGE = 'El stock eliminado no puede ser actualizado';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

async function syncStockAlertForStock(
  emid: string,
  suid: string,
  productId: string,
): Promise<void> {
  try {
    const companyConfig = await findStockAlertCompanyAlertConfig(emid);

    const lowStockProduct = await findLowStockProductByStock(emid, suid, productId);

    if (!lowStockProduct) {
      await hideAlertByStock(emid, suid, productId);
      return;
    }

    if (!companyConfig.active) {
      await hideAlertByStock(emid, suid, productId);
      return;
    }

    const mensaje = `Stock bajo en ${lowStockProduct.sucursalnombre}: ${lowStockProduct.prdtonombre} (${lowStockProduct.prdtocodigo}) - Actual: ${lowStockProduct.stckcantidad}, Mínimo: ${lowStockProduct.prdtostockminimo}`;

    await upsertAlert({
      alemid: lowStockProduct.stckemid,
      alsuid: lowStockProduct.stcksuid,
      alprdtoid: lowStockProduct.stckprdtoid,
      altipo: 'stock_bajo',
      almensaje: mensaje,
      alcantidadactual: lowStockProduct.stckcantidad,
      alstockminimo: lowStockProduct.prdtostockminimo,
      alstockmaximo: lowStockProduct.prdtostockmaximo,
    });
  } catch (error) {
    logger.error(
      { err: error, companyId: emid, branchId: suid, productId },
      'Error syncing stock alert after stock change',
    );
  }
}

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
  const { stcksuid, page, pageSize, search, status } = params;
  const validatedBranchId = validateRequiredString(stcksuid, EMPTY_STOCK_BRANCH_ID_MESSAGE);

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(INVALID_PAGE_MESSAGE);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(INVALID_PAGE_SIZE_MESSAGE);
  }

  const normalizedSearch = typeof search === 'string'
    ? search.trim()
    : undefined;

  const validatedParams: FindStocksParamsDto = {
    stcksuid: validatedBranchId,
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

function validateFindStocksByCompanyParams(
  params: FindStocksByCompanyParamsDto,
): FindStocksByCompanyParamsDto {
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

  const validatedParams: FindStocksByCompanyParamsDto = {
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
      throw new Error('El stock no fue creado');
    }

    await syncStockAlertForStock(stckemid, stcksuid, stckprdtoid);

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
      throw new Error('Stock no encontrado');
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
      throw new Error('Stock no encontrado');
    }

    if (stockDB.stcksuid !== stcksuid) {
      throw new Error('Stock no encontrado');
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

    await syncStockAlertForStock(user.usemid, stcksuid, stockDB.stckprdtoid);

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
