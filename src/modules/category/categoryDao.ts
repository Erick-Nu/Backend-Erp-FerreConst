import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreateCategoryDao = {
  ctgriaemid: string;
  ctgnombre: string;
  ctgriadescripcion: string | null;
};

type FindCategoryByIdDao = {
  ctgriaemid: string;
  ctgriaid: string;
};

type FindCategoryByNameDao = {
  ctgriaemid: string;
  ctgnombre: string;
};

type FindCategoriesParamsDao = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type UpdateColumnCategoryDao = {
  column: string,
  value: string | number | boolean | Date | null;
}

type CategoryRowDao = {
  ctgriaid: string;
  ctgriaemid: string;
  ctgnombre: string;
  ctgriadescripcion: string | null;
  ctgriafchregistro: Date;
  ctgriaestado: Status;
};

type FindCategoriesResponseDao = {
  items: CategoryRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_CATEGORY_QUERY = `
  insert into categoria (ctgriaemid, ctgnombre, ctgriadescripcion)
  values ($1, $2, $3)
  returning ctgriaid
`;

async function saveCategory(category: CreateCategoryDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ ctgriaid: string }[]>(SAVE_CATEGORY_QUERY, [
      category.ctgriaemid,
      category.ctgnombre,
      category.ctgriadescripcion,
    ]);

    const categoryDB = result[0];
    if (!categoryDB) {
      throw new Error('Category was not created');
    }

    logger.info(
      {
        categoryId: categoryDB.ctgriaid,
        companyId: category.ctgriaemid,
      },
      'Category created',
    );

    return categoryDB.ctgriaid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: category.ctgriaemid,
      },
      'Error saving category',
    );
    throw new Error('Error saving category');
  }
}

const FIND_CATEGORY_BY_ID_QUERY = `
  select ctgriaid, ctgriaemid, ctgnombre, ctgriadescripcion, ctgriafchregistro, ctgriaestado
  from categoria
  where ctgriaemid = $1 and ctgriaid = $2
`;

async function findCategoryById(category: FindCategoryByIdDao): Promise<CategoryRowDao | null> {
  try {
    const result = await sql.unsafe<CategoryRowDao[]>(FIND_CATEGORY_BY_ID_QUERY, [
      category.ctgriaemid,
      category.ctgriaid,
    ]);
    const categoryDB = result[0];

    if (!categoryDB) {
      return null;
    }

    return categoryDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: category.ctgriaemid,
        categoryId: category.ctgriaid,
      },
      'Error finding category by id',
    );
    throw new Error('Error finding category by id');
  }
}

const FIND_CATEGORY_BY_NAME_QUERY = `
  select ctgriaid, ctgriaemid, ctgnombre, ctgriadescripcion, ctgriafchregistro, ctgriaestado
  from categoria
  where ctgriaemid = $1 and lower(trim(ctgnombre)) = lower(trim($2))
`;

async function findCategoryByName(category: FindCategoryByNameDao): Promise<CategoryRowDao | null> {
  try {
    const result = await sql.unsafe<CategoryRowDao[]>(FIND_CATEGORY_BY_NAME_QUERY, [
      category.ctgriaemid,
      category.ctgnombre,
    ]);
    const categoryDB = result[0];

    if (!categoryDB) {
      return null;
    }

    return categoryDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: category.ctgriaemid,
        name: category.ctgnombre,
      },
      'Error finding category by name',
    );
    throw new Error('Error finding category by name');
  }
}

type CategoryQueryValue = string | number;

function buildFindCategoriesWhereClause(
  companyId: string,
  params: Pick<FindCategoriesParamsDao, 'search' | 'status'>,
): { clause: string; values: CategoryQueryValue[] } {
  const conditions = ['ctgriaemid = $1'];
  const values: CategoryQueryValue[] = [companyId];

  if (params.status) {
    values.push(params.status);
    conditions.push(`ctgriaestado = $${values.length}`);
  } else {
    conditions.push(`ctgriaestado != 'eliminado'`);
  }

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    const searchParamIndex = values.length;

    conditions.push(`(
      lower(trim(ctgnombre)) like $${searchParamIndex}
      or lower(trim(ctgriadescripcion)) like $${searchParamIndex}
    )`);
  }

  return {
    clause: conditions.join(' and '),
    values,
  };
}

function buildFindCategoriesQuery(
  params: FindCategoriesParamsDao,
  companyId: string,
): { query: string; values: CategoryQueryValue[] } {
  const where = buildFindCategoriesWhereClause(companyId, params);
  const offset = (params.page - 1) * params.pageSize;
  const values = [...where.values, params.pageSize, offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const query = `
    select ctgriaid, ctgriaemid, ctgnombre, ctgriadescripcion, ctgriafchregistro, ctgriaestado
    from categoria
    where ${where.clause}
    order by ctgriafchregistro desc
    limit $${limitParamIndex}
    offset $${offsetParamIndex}
  `;

  return { query, values };
}

function buildCountCategoriesQuery(
  params: FindCategoriesParamsDao,
  companyId: string,
): { query: string; values: CategoryQueryValue[] } {
  const where = buildFindCategoriesWhereClause(companyId, params);
  const query = `
    select count(*)::int as total
    from categoria
    where ${where.clause}
  `;

  return { query, values: where.values };
}

async function findCategories(
  params: FindCategoriesParamsDao,
  companyId: string,
): Promise<FindCategoriesResponseDao> {
  const { page, pageSize, search } = params;

  try {
    const findCategoriesQuery = buildFindCategoriesQuery(params, companyId);
    const countCategoriesQuery = buildCountCategoriesQuery(params, companyId);

    const [result, categoriesTotalDB] = await Promise.all([
      sql.unsafe<CategoryRowDao[]>(findCategoriesQuery.query, findCategoriesQuery.values),
      sql.unsafe<{ total: number }[]>(countCategoriesQuery.query, countCategoriesQuery.values),
    ]);

    const totalItems = categoriesTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting categories');
    }

    const categoriesDB: FindCategoriesResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return categoriesDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, search, companyId }, 'Error finding categories');
    throw new Error('Error finding categories');
  }
}

const UPDATE_CATEGORY_BY_ID_QUERY = (dataDB: UpdateColumnCategoryDao[], category: FindCategoryByIdDao) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(category.ctgriaid);
  values.push(category.ctgriaemid);

  const query = `
    update categoria
    set ${setClause.join(', ')}
    where ctgriaid = $${values.length - 1} and ctgriaemid = $${values.length}
    returning ctgriaid, ctgriaemid, ctgnombre, ctgriadescripcion, ctgriafchregistro, ctgriaestado
  `;

  return { query, values };
};

async function updateCategoryById(
  dataDB: UpdateColumnCategoryDao[],
  category: FindCategoryByIdDao,
): Promise<CategoryRowDao | null> {
  try {
    const { query, values } = UPDATE_CATEGORY_BY_ID_QUERY(dataDB, category);
    const result = await sql.unsafe<CategoryRowDao[]>(query, values);
    const updatedCategory = result[0];

    if (!updatedCategory) {
      return null;
    }

    return updatedCategory;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: category.ctgriaemid,
        categoryId: category.ctgriaid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating category by id',
    );
    throw new Error('Error updating category by id');
  }
}

export { saveCategory, findCategoryById, findCategoryByName, findCategories, updateCategoryById };
