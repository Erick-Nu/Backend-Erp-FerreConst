import type { Status } from '../../config/databaseTypes.js';
import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

type CreateProductDao = {
  prdtoemid: string;
  prdtoctgriaid: string;
  prdtomrcid: string;
  prdtoprovid: string;
  prdtomdiaid: string;
  prdtocodigo: string;
  prdtonombre: string;
  prdtopreciocompra: number;
  prdtoprecioventa: number;
  prdtostockminimo: number;
  prdtostockmaximo: number;
  prdtoimagen: string | null;
};

type FindProductByIdDao = {
  prdtoemid: string;
  prdtoid: string;
};

type FindProductByCodeDao = {
  prdtoemid: string;
  prdtocodigo: string;
};

type FindProductByNameDao = {
  prdtoemid: string;
  prdtonombre: string;
};

type FindProductsParamsDao = {
  page: number;
  pageSize: number;
};

type UpdateColumnProductDao = {
  column: string;
  value: string | number | boolean | Date | null;
};

type ProductRowDao = {
  prdtoid: string;
  prdtoemid: string;
  prdtoctgriaid: string;
  prdtomrcid: string;
  prdtoprovid: string;
  prdtomdiaid: string;
  prdtocodigo: string;
  prdtonombre: string;
  prdtopreciocompra: number;
  prdtoprecioventa: number;
  prdtostockminimo: number;
  prdtostockmaximo: number;
  prdtoimagen: string | null;
  prdtofchregistro: Date;
  prdtoestado: Status;
  ctgnombre?: string | null;
  ctgriadescripcion?: string | null;
  mrcnombre?: string | null;
  provnombre?: string | null;
  mdianombre?: string | null;
  mdiaabreviatura?: string | null;
};

type FindProductsResponseDao = {
  items: ProductRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_PRODUCT_QUERY = `
  insert into producto (
    prdtoemid,
    prdtoctgriaid,
    prdtomrcid,
    prdtoprovid,
    prdtomdiaid,
    prdtocodigo,
    prdtonombre,
    prdtopreciocompra,
    prdtoprecioventa,
    prdtostockminimo,
    prdtostockmaximo,
    prdtoimagen
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  returning prdtoid
`;

async function saveProduct(product: CreateProductDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ prdtoid: string }[]>(SAVE_PRODUCT_QUERY, [
      product.prdtoemid,
      product.prdtoctgriaid,
      product.prdtomrcid,
      product.prdtoprovid,
      product.prdtomdiaid,
      product.prdtocodigo,
      product.prdtonombre,
      product.prdtopreciocompra,
      product.prdtoprecioventa,
      product.prdtostockminimo,
      product.prdtostockmaximo,
      product.prdtoimagen,
    ]);

    const productDB = result[0];
    if (!productDB) {
      throw new Error('Product was not created');
    }

    logger.info(
      {
        productId: productDB.prdtoid,
        companyId: product.prdtoemid,
      },
      'Product created',
    );

    return productDB.prdtoid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: product.prdtoemid,
      },
      'Error saving product',
    );
    throw new Error('Error saving product');
  }
}

const FIND_PRODUCT_BY_ID_QUERY = `
  select
    p.prdtoid,
    p.prdtoemid,
    p.prdtoctgriaid,
    p.prdtomrcid,
    p.prdtoprovid,
    p.prdtomdiaid,
    p.prdtocodigo,
    p.prdtonombre,
    p.prdtopreciocompra,
    p.prdtoprecioventa,
    p.prdtostockminimo,
    p.prdtostockmaximo,
    p.prdtoimagen,
    p.prdtofchregistro,
    p.prdtoestado,
    c.ctgnombre,
    c.ctgriadescripcion,
    m.mrcnombre,
    pr.provnombre,
    md.mdianombre,
    md.mdiaabreviatura
  from producto p
  left join categoria c
    on c.ctgriaid = p.prdtoctgriaid
    and c.ctgriaemid = p.prdtoemid
  left join marca m
    on m.mrcid = p.prdtomrcid
    and m.mrcemid = p.prdtoemid
  left join proveedor pr
    on pr.provid = p.prdtoprovid
    and pr.provemid = p.prdtoemid
  left join medida md
    on md.mdiaid = p.prdtomdiaid
    and md.mdiaemid = p.prdtoemid
  where p.prdtoemid = $1 and p.prdtoid = $2
`;

async function findProductById(product: FindProductByIdDao): Promise<ProductRowDao | null> {
  try {
    const result = await sql.unsafe<ProductRowDao[]>(FIND_PRODUCT_BY_ID_QUERY, [
      product.prdtoemid,
      product.prdtoid,
    ]);
    const productDB = result[0];

    if (!productDB) {
      return null;
    }

    return productDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: product.prdtoemid,
        productId: product.prdtoid,
      },
      'Error finding product by id',
    );
    throw new Error('Error finding product by id');
  }
}

const FIND_PRODUCT_BY_CODE_QUERY = `
  select
    p.prdtoid,
    p.prdtoemid,
    p.prdtoctgriaid,
    p.prdtomrcid,
    p.prdtoprovid,
    p.prdtomdiaid,
    p.prdtocodigo,
    p.prdtonombre,
    p.prdtopreciocompra,
    p.prdtoprecioventa,
    p.prdtostockminimo,
    p.prdtostockmaximo,
    p.prdtoimagen,
    p.prdtofchregistro,
    p.prdtoestado,
    c.ctgnombre,
    m.mrcnombre,
    pr.provnombre,
    md.mdianombre,
    md.mdiaabreviatura
  from producto p
  left join categoria c
    on c.ctgriaid = p.prdtoctgriaid
    and c.ctgriaemid = p.prdtoemid
  left join marca m
    on m.mrcid = p.prdtomrcid
    and m.mrcemid = p.prdtoemid
  left join proveedor pr
    on pr.provid = p.prdtoprovid
    and pr.provemid = p.prdtoemid
  left join medida md
    on md.mdiaid = p.prdtomdiaid
    and md.mdiaemid = p.prdtoemid
  where p.prdtoemid = $1 and lower(trim(p.prdtocodigo)) = lower(trim($2))
`;

async function findProductByCode(product: FindProductByCodeDao): Promise<ProductRowDao | null> {
  try {
    const result = await sql.unsafe<ProductRowDao[]>(FIND_PRODUCT_BY_CODE_QUERY, [
      product.prdtoemid,
      product.prdtocodigo,
    ]);
    const productDB = result[0];

    if (!productDB) {
      return null;
    }

    return productDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: product.prdtoemid,
        productCode: product.prdtocodigo,
      },
      'Error finding product by code',
    );
    throw new Error('Error finding product by code');
  }
}

const FIND_PRODUCT_BY_NAME_QUERY = `
  select
    p.prdtoid,
    p.prdtoemid,
    p.prdtoctgriaid,
    p.prdtomrcid,
    p.prdtoprovid,
    p.prdtomdiaid,
    p.prdtocodigo,
    p.prdtonombre,
    p.prdtopreciocompra,
    p.prdtoprecioventa,
    p.prdtostockminimo,
    p.prdtostockmaximo,
    p.prdtoimagen,
    p.prdtofchregistro,
    p.prdtoestado,
    c.ctgnombre,
    m.mrcnombre,
    pr.provnombre,
    md.mdianombre,
    md.mdiaabreviatura
  from producto p
  left join categoria c
    on c.ctgriaid = p.prdtoctgriaid
    and c.ctgriaemid = p.prdtoemid
  left join marca m
    on m.mrcid = p.prdtomrcid
    and m.mrcemid = p.prdtoemid
  left join proveedor pr
    on pr.provid = p.prdtoprovid
    and pr.provemid = p.prdtoemid
  left join medida md
    on md.mdiaid = p.prdtomdiaid
    and md.mdiaemid = p.prdtoemid
  where p.prdtoemid = $1 and lower(trim(p.prdtonombre)) = lower(trim($2))
`;

async function findProductByName(product: FindProductByNameDao): Promise<ProductRowDao | null> {
  try {
    const result = await sql.unsafe<ProductRowDao[]>(FIND_PRODUCT_BY_NAME_QUERY, [
      product.prdtoemid,
      product.prdtonombre,
    ]);
    const productDB = result[0];

    if (!productDB) {
      return null;
    }

    return productDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: product.prdtoemid,
        productName: product.prdtonombre,
      },
      'Error finding product by name',
    );
    throw new Error('Error finding product by name');
  }
}

const FIND_PRODUCTS_QUERY = `
  select
    p.prdtoid,
    p.prdtoemid,
    p.prdtoctgriaid,
    p.prdtomrcid,
    p.prdtoprovid,
    p.prdtomdiaid,
    p.prdtocodigo,
    p.prdtonombre,
    p.prdtopreciocompra,
    p.prdtoprecioventa,
    p.prdtostockminimo,
    p.prdtostockmaximo,
    p.prdtoimagen,
    p.prdtofchregistro,
    p.prdtoestado,
    c.ctgnombre,
    m.mrcnombre,
    pr.provnombre,
    md.mdianombre,
    md.mdiaabreviatura
  from producto p
  left join categoria c
    on c.ctgriaid = p.prdtoctgriaid
    and c.ctgriaemid = p.prdtoemid
  left join marca m
    on m.mrcid = p.prdtomrcid
    and m.mrcemid = p.prdtoemid
  left join proveedor pr
    on pr.provid = p.prdtoprovid
    and pr.provemid = p.prdtoemid
  left join medida md
    on md.mdiaid = p.prdtomdiaid
    and md.mdiaemid = p.prdtoemid
  where p.prdtoemid = $1
  order by p.prdtofchregistro desc
  limit $2
  offset $3
`;

const COUNT_PRODUCTS_QUERY = `
  select count(*)::int as total
  from producto
  where prdtoemid = $1
`;

async function findProducts(
  params: FindProductsParamsDao,
  companyId: string,
): Promise<FindProductsResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const result = await sql.unsafe<ProductRowDao[]>(FIND_PRODUCTS_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const productsTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_PRODUCTS_QUERY, [companyId]);
    const totalItems = productsTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting products');
    }

    const productsDB: FindProductsResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return productsDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding products');
    throw new Error('Error finding products');
  }
}

const UPDATE_PRODUCT_BY_ID_QUERY = (dataDB: UpdateColumnProductDao[], product: FindProductByIdDao) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(product.prdtoid);
  values.push(product.prdtoemid);

  const query = `
    update producto
    set ${setClause.join(', ')}
    where prdtoid = $${values.length - 1} and prdtoemid = $${values.length}
    returning
      prdtoid,
      prdtoemid,
      prdtoctgriaid,
      prdtomrcid,
      prdtoprovid,
      prdtomdiaid,
      prdtocodigo,
      prdtonombre,
      prdtopreciocompra,
      prdtoprecioventa,
      prdtostockminimo,
      prdtostockmaximo,
      prdtoimagen,
      prdtofchregistro,
      prdtoestado
  `;

  return { query, values };
};

async function updateProductById(
  dataDB: UpdateColumnProductDao[],
  product: FindProductByIdDao,
): Promise<ProductRowDao | null> {
  try {
    const { query, values } = UPDATE_PRODUCT_BY_ID_QUERY(dataDB, product);
    const result = await sql.unsafe<ProductRowDao[]>(query, values);
    const updatedProduct = result[0];

    if (!updatedProduct) {
      return null;
    }

    return updatedProduct;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: product.prdtoemid,
        productId: product.prdtoid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating product by id',
    );
    throw new Error('Error updating product by id');
  }
}

export {
  saveProduct,
  findProductById,
  findProductByCode,
  findProductByName,
  findProducts,
  updateProductById,
};

export type {
  ProductRowDao,
  FindProductsResponseDao,
};
