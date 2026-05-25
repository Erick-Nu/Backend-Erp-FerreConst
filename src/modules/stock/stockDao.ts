import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreateStockDao = {
  stckemid: string;
  stcksuid: string;
  stckprdtoid: string;
  stckcantidad: number;
};

type FindStockByIdDao = {
  stckemid: string;
  stckid: string;
};

type UpdateStockByIdDao = {
  stckemid: string;
  stcksuid: string;
  stckid: string;
};

type FindStockByProductIdDao = {
  stckemid: string;
  stcksuid: string;
  stckprdtoid: string;
};

type FindStocksParamsDao = {
  page: number;
  pageSize: number;
};

type UpdateColumnStockDao = {
  column: string,
  value: string | number | boolean | Date | null;
}

type StockRowDao = {
  stckid: string;
  stckemid: string;
  stcksuid: string;
  stckprdtoid: string;
  stckcantidad: number;
  stckfchregistro: Date;
  stckfchactualizacion: Date;
  stckestado: Status;
  sunombre?: string | null;
  suidentificador?: string | null;
  prdtocodigo?: string | null;
  prdtonombre?: string | null;
};

type FindStocksResponseDao = {
  items: StockRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_STOCK_QUERY = `
  insert into stock (stckemid, stcksuid, stckprdtoid, stckcantidad)
  values ($1, $2, $3, $4)
  returning stckid
`;

async function saveStock(stock: CreateStockDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ stckid: string }[]>(SAVE_STOCK_QUERY, [
      stock.stckemid,
      stock.stcksuid,
      stock.stckprdtoid,
      stock.stckcantidad,
    ]);

    const stockDB = result[0];
    if (!stockDB) {
      throw new Error('Stock was not created');
    }

    logger.info(
      {
        stockId: stockDB.stckid,
        companyId: stock.stckemid,
        branchId: stock.stcksuid,
      },
      'Stock created',
    );

    return stockDB.stckid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: stock.stckemid,
        branchId: stock.stcksuid,
      },
      'Error saving stock',
    );
    throw new Error('Error saving stock');
  }
}

const FIND_STOCK_BY_ID_QUERY = `
  select
    st.stckid,
    st.stckemid,
    st.stcksuid,
    st.stckprdtoid,
    st.stckcantidad,
    st.stckfchregistro,
    st.stckfchactualizacion,
    st.stckestado,
    s.sunombre,
    s.suidentificador,
    p.prdtocodigo,
    p.prdtonombre
  from stock st
  left join sucursal s
    on s.suid = st.stcksuid
    and s.suemid = st.stckemid
  left join producto p
    on p.prdtoid = st.stckprdtoid
    and p.prdtoemid = st.stckemid
  where st.stckemid = $1 and st.stckid = $2
`;

async function findStockById(stock: FindStockByIdDao): Promise<StockRowDao | null> {
  try {
    const result = await sql.unsafe<StockRowDao[]>(FIND_STOCK_BY_ID_QUERY, [
      stock.stckemid,
      stock.stckid,
    ]);
    const stockDB = result[0];

    if (!stockDB) {
      return null;
    }

    return stockDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: stock.stckemid,
        stockId: stock.stckid,
      },
      'Error finding stock by id',
    );
    throw new Error('Error finding stock by id');
  }
}

const FIND_STOCK_BY_PRODUCT_ID_QUERY = `
  select
    st.stckid,
    st.stckemid,
    st.stcksuid,
    st.stckprdtoid,
    st.stckcantidad,
    st.stckfchregistro,
    st.stckfchactualizacion,
    st.stckestado,
    s.sunombre,
    s.suidentificador,
    p.prdtocodigo,
    p.prdtonombre
  from stock st
  left join sucursal s
    on s.suid = st.stcksuid
    and s.suemid = st.stckemid
  left join producto p
    on p.prdtoid = st.stckprdtoid
    and p.prdtoemid = st.stckemid
  where st.stckemid = $1 and st.stcksuid = $2 and st.stckprdtoid = $3
`;

async function findStockByProductId(stock: FindStockByProductIdDao): Promise<StockRowDao | null> {
  try {
    const result = await sql.unsafe<StockRowDao[]>(FIND_STOCK_BY_PRODUCT_ID_QUERY, [
      stock.stckemid,
      stock.stcksuid,
      stock.stckprdtoid,
    ]);
    const stockDB = result[0];

    if (!stockDB) {
      return null;
    }

    return stockDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: stock.stckemid,
        branchId: stock.stcksuid,
        productId: stock.stckprdtoid,
      },
      'Error finding stock by product id',
    );
    throw new Error('Error finding stock by product id');
  }
}

const FIND_STOCKS_QUERY = `
  select
    st.stckid,
    st.stckemid,
    st.stcksuid,
    st.stckprdtoid,
    st.stckcantidad,
    st.stckfchregistro,
    st.stckfchactualizacion,
    st.stckestado,
    s.sunombre,
    s.suidentificador,
    p.prdtocodigo,
    p.prdtonombre
  from stock st
  left join sucursal s
    on s.suid = st.stcksuid
    and s.suemid = st.stckemid
  left join producto p
    on p.prdtoid = st.stckprdtoid
    and p.prdtoemid = st.stckemid
  where st.stckemid = $1 and st.stcksuid = $2
  order by st.stckfchregistro desc
  limit $3
  offset $4
`;

const COUNT_STOCKS_QUERY = `
  select count(*)::int as total
  from stock
  where stckemid = $1 and stcksuid = $2
`;

const FIND_STOCKS_BY_COMPANY_QUERY = `
  select
    st.stckid,
    st.stckemid,
    st.stcksuid,
    st.stckprdtoid,
    st.stckcantidad,
    st.stckfchregistro,
    st.stckfchactualizacion,
    st.stckestado,
    s.sunombre,
    s.suidentificador,
    p.prdtocodigo,
    p.prdtonombre
  from stock st
  left join sucursal s
    on s.suid = st.stcksuid
    and s.suemid = st.stckemid
  left join producto p
    on p.prdtoid = st.stckprdtoid
    and p.prdtoemid = st.stckemid
  where st.stckemid = $1
  order by st.stckfchregistro desc
  limit $2
  offset $3
`;

const COUNT_STOCKS_BY_COMPANY_QUERY = `
  select count(*)::int as total
  from stock
  where stckemid = $1
`;

async function findStocks(
  params: FindStocksParamsDao,
  companyId: string,
  branchId: string,
): Promise<FindStocksResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const result = await sql.unsafe<StockRowDao[]>(FIND_STOCKS_QUERY, [
      companyId,
      branchId,
      pageSize,
      offset,
    ]);

    const stocksTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_STOCKS_QUERY, [companyId, branchId]);
    const totalItems = stocksTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting stocks');
    }

    const stocksDB: FindStocksResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return stocksDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId, branchId }, 'Error finding stocks');
    throw new Error('Error finding stocks');
  }
}

async function findStocksByCompany(
  params: FindStocksParamsDao,
  companyId: string,
): Promise<FindStocksResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const result = await sql.unsafe<StockRowDao[]>(FIND_STOCKS_BY_COMPANY_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const stocksTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_STOCKS_BY_COMPANY_QUERY, [companyId]);
    const totalItems = stocksTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting stocks');
    }

    const stocksDB: FindStocksResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return stocksDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding stocks by company');
    throw new Error('Error finding stocks by company');
  }
}

const UPDATE_STOCK_BY_ID_QUERY = (dataDB: UpdateColumnStockDao[], stock: UpdateStockByIdDao) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(stock.stckid);
  values.push(stock.stckemid);
  values.push(stock.stcksuid);

  const query = `
    update stock
    set ${setClause.join(', ')}
    where stckid = $${values.length - 2} and stckemid = $${values.length - 1} and stcksuid = $${values.length}
    returning stckid, stckemid, stcksuid, stckprdtoid, stckcantidad, stckfchregistro, stckfchactualizacion, stckestado
  `;

  return { query, values };
};

async function updateStockById(
  dataDB: UpdateColumnStockDao[],
  stock: UpdateStockByIdDao,
): Promise<StockRowDao | null> {
  try {
    const { query, values } = UPDATE_STOCK_BY_ID_QUERY(dataDB, stock);
    const result = await sql.unsafe<StockRowDao[]>(query, values);
    const updatedStock = result[0];

    if (!updatedStock) {
      return null;
    }

    return updatedStock;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: stock.stckemid,
        branchId: stock.stcksuid,
        stockId: stock.stckid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating stock by id',
    );
    throw new Error('Error updating stock by id');
  }
}

export {
  saveStock,
  findStockById,
  findStockByProductId,
  findStocks,
  findStocksByCompany,
  updateStockById,
};

export type {
  CreateStockDao,
  FindStockByIdDao,
  UpdateStockByIdDao,
  FindStockByProductIdDao,
  FindStocksParamsDao,
  UpdateColumnStockDao,
  StockRowDao,
  FindStocksResponseDao,
};
