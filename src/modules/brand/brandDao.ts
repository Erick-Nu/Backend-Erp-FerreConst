import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreateBrandDao = {
  mrcemid: string;
  mrcnombre: string;
};

type FindBrandByIdDao = {
  mrcemid: string;
  mrcid: string;
};

type FindBrandByNameDao = {
  mrcemid: string;
  mrcnombre: string;
};

type FindBrandsParamsDao = {
  page: number;
  pageSize: number;
};

type UpdateColumnBrandDao = {
  column: string,
  value: string | number | boolean | Date | null;
}

type BrandRowDao = {
  mrcid: string;
  mrcemid: string;
  mrcnombre: string;
  mrcfchregistro: Date;
  mrcestado: Status;
};

type FindBrandsResponseDao = {
  items: BrandRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_BRAND_QUERY = `
  insert into marca (mrcemid, mrcnombre)
  values ($1, $2)
  returning mrcid
`;

async function saveBrand(brand: CreateBrandDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ mrcid: string }[]>(SAVE_BRAND_QUERY, [
      brand.mrcemid,
      brand.mrcnombre,
    ]);

    const brandDB = result[0];
    if (!brandDB) {
      throw new Error('Brand was not created');
    }

    logger.info(
      {
        brandId: brandDB.mrcid,
        companyId: brand.mrcemid,
      },
      'Brand created',
    );

    return brandDB.mrcid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: brand.mrcemid,
      },
      'Error saving brand',
    );
    throw new Error('Error saving brand');
  }
}

const FIND_BRAND_BY_ID_QUERY = `
  select mrcid, mrcemid, mrcnombre, mrcfchregistro, mrcestado
  from marca
  where mrcemid = $1 and mrcid = $2
`;

async function findBrandById(brand: FindBrandByIdDao): Promise<BrandRowDao | null> {
  try {
    const result = await sql.unsafe<BrandRowDao[]>(FIND_BRAND_BY_ID_QUERY, [
      brand.mrcemid,
      brand.mrcid,
    ]);
    const brandDB = result[0];

    if (!brandDB) {
      return null;
    }

    return brandDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: brand.mrcemid,
        brandId: brand.mrcid,
      },
      'Error finding brand by id',
    );
    throw new Error('Error finding brand by id');
  }
}

const FIND_BRAND_BY_NAME_QUERY = `
  select mrcid, mrcemid, mrcnombre, mrcfchregistro, mrcestado
  from marca
  where mrcemid = $1 and lower(trim(mrcnombre)) = lower(trim($2))
`;

async function findBrandByName(brand: FindBrandByNameDao): Promise<BrandRowDao | null> {
  try {
    const result = await sql.unsafe<BrandRowDao[]>(FIND_BRAND_BY_NAME_QUERY, [
      brand.mrcemid,
      brand.mrcnombre,
    ]);
    const brandDB = result[0];

    if (!brandDB) {
      return null;
    }

    return brandDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: brand.mrcemid,
        name: brand.mrcnombre,
      },
      'Error finding brand by name',
    );
    throw new Error('Error finding brand by name');
  }
}

const FIND_BRANDS_QUERY = `
  select mrcid, mrcemid, mrcnombre, mrcfchregistro, mrcestado
  from marca
  where mrcemid = $1
  order by mrcfchregistro desc
  limit $2
  offset $3
`;

const COUNT_BRANDS_QUERY = `
  select count(*)::int as total
  from marca
  where mrcemid = $1
`;

async function findBrands(
  params: FindBrandsParamsDao,
  companyId: string,
): Promise<FindBrandsResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const result = await sql.unsafe<BrandRowDao[]>(FIND_BRANDS_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const brandsTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_BRANDS_QUERY, [companyId]);
    const totalItems = brandsTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting brands');
    }

    const brandsDB: FindBrandsResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return brandsDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding brands');
    throw new Error('Error finding brands');
  }
}

const UPDATE_BRAND_BY_ID_QUERY = (
  dataDB: UpdateColumnBrandDao[],
  brand: FindBrandByIdDao,
) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(brand.mrcid);
  values.push(brand.mrcemid);

  const query = `
    update marca
    set ${setClause.join(', ')}
    where mrcid = $${values.length - 1} and mrcemid = $${values.length}
    returning mrcid, mrcemid, mrcnombre, mrcfchregistro, mrcestado
  `;

  return { query, values };
};

async function updateBrandById(
  dataDB: UpdateColumnBrandDao[],
  brand: FindBrandByIdDao,
): Promise<BrandRowDao | null> {
  try {
    const { query, values } = UPDATE_BRAND_BY_ID_QUERY(dataDB, brand);
    const result = await sql.unsafe<BrandRowDao[]>(query, values);
    const updatedBrand = result[0];

    if (!updatedBrand) {
      return null;
    }

    return updatedBrand;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: brand.mrcemid,
        brandId: brand.mrcid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating brand by id',
    );
    throw new Error('Error updating brand by id');
  }
}

export { saveBrand, findBrandById, findBrandByName, findBrands, updateBrandById };
