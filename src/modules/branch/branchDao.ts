import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreateBranchDao = {
  suemid: string;
  sunombre: string;
  sudireccion: string | null;
  sucorreo: string | null;
  suidentificador: string;
};

type FindBranchByIdentifierDao = {
  suemid: string;
  suidentificador: string;
};

type FindBranchByIdDao = {
  suemid: string;
  suid: string;
};

type FindBranchesParamsDao = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type UpdateColumnBranchDao = {
  column: string,
  value: string | number | boolean | Date | null;
}

type FindBranchesResponseDao = {
  items: BranchRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type BranchRowDao = {
  suid: string;
  suemid: string;
  sunombre: string;
  sudireccion: string | null;
  sucorreo: string | null;
  suidentificador: string;
  sufchregistro: Date;
  suestado: Status;
};

const SAVE_BRANCH_QUERY = `
  insert into sucursal (suemid, sunombre, suidentificador)
  values ($1, $2, $3) returning suid
`;

async function saveBranch(branch: CreateBranchDao): Promise<string> {
  try {
    const result = await sql.unsafe<{suid: string}[]>(SAVE_BRANCH_QUERY, [
      branch.suemid,
      branch.sunombre,
      branch.suidentificador,
    ]);

    const branchDB = result[0];
      
    if (!branchDB ) {
      throw new Error('Branch was not created');
    }

    logger.info({ branchId: branchDB.suid, companyId: branch.suemid }, 'Branch created');

    return branchDB.suid; 
  } catch (error) {
    logger.error({ err: error, companyId: branch.suemid }, 'Error saving branch');
    throw new Error('Error saving branch');
  }
}

const FIND_BRANCH_BY_IDENTIFIER_QUERY = `select suid from sucursal where suemid = $1 and suidentificador = $2`;

async function findBranchByIdentifier(branch: FindBranchByIdentifierDao): Promise<string | null> {
  try {
    const result = await sql.unsafe<{ suid: string }[]>(FIND_BRANCH_BY_IDENTIFIER_QUERY, [branch.suemid, branch.suidentificador]);
    const identifierDB = result[0];
    if (!identifierDB) {
      return null;
    }
    return identifierDB.suid;
  } catch (error) {
    logger.error({ err: error, companyId: branch.suemid, identifier: branch.suidentificador }, 'Error finding branch by identifier');
    throw new Error('Error finding branch by identifier');
  }
}

const FIND_BRANCH_BY_ID_QUERY = `
  select suid, suemid, sunombre, sudireccion, sucorreo, suidentificador, sufchregistro, suestado
  from sucursal
  where suemid = $1 and suid = $2
`;

async function findBranchById(branch: FindBranchByIdDao): Promise<BranchRowDao | null> {
  try {
    const result = await sql.unsafe<BranchRowDao[]>(FIND_BRANCH_BY_ID_QUERY, [branch.suemid, branch.suid]);
    const branchDB = result[0];

    if (!branchDB) {
      return null;
    }

    return branchDB;
  } catch (error) {
    logger.error({ err: error, companyId: branch.suemid, branchId: branch.suid }, 'Error finding branch by id');
    throw new Error('Error finding branch by id');
  }
}

type BranchQueryValue = string | number;

function buildFindBranchesWhereClause(
  companyId: string,
  params: Pick<FindBranchesParamsDao, 'search' | 'status'>,
): { clause: string; values: BranchQueryValue[] } {
  const conditions = ['suemid = $1'];
  const values: BranchQueryValue[] = [companyId];

  if (params.status) {
    values.push(params.status);
    conditions.push(`suestado = $${values.length}`);
  } else {
    conditions.push(`suestado != 'eliminado'`);
  }

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    const searchParamIndex = values.length;

    conditions.push(`(
      lower(trim(sunombre)) like $${searchParamIndex}
      or lower(trim(suidentificador)) like $${searchParamIndex}
    )`);
  }

  return {
    clause: conditions.join(' and '),
    values,
  };
}

function buildFindBranchesQuery(
  params: FindBranchesParamsDao,
  companyId: string,
): { query: string; values: BranchQueryValue[] } {
  const where = buildFindBranchesWhereClause(companyId, params);
  const offset = (params.page - 1) * params.pageSize;
  const values = [...where.values, params.pageSize, offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const query = `
    select suid, suemid, sunombre, sudireccion, sucorreo, suidentificador, sufchregistro, suestado
    from sucursal
    where ${where.clause}
    order by sufchregistro desc
    limit $${limitParamIndex}
    offset $${offsetParamIndex}
  `;

  return { query, values };
}

function buildCountBranchesQuery(
  params: FindBranchesParamsDao,
  companyId: string,
): { query: string; values: BranchQueryValue[] } {
  const where = buildFindBranchesWhereClause(companyId, params);
  const query = `
    select count(*)::int as total
    from sucursal
    where ${where.clause}
  `;

  return { query, values: where.values };
}

async function findBranches(
  params: FindBranchesParamsDao,
  companyId: string,
): Promise<FindBranchesResponseDao> {
  const { page, pageSize, search } = params;

  try {
    const findBranchesQuery = buildFindBranchesQuery(params, companyId);
    const countBranchesQuery = buildCountBranchesQuery(params, companyId);

    const [result, branchesTotalDB] = await Promise.all([
      sql.unsafe<BranchRowDao[]>(findBranchesQuery.query, findBranchesQuery.values),
      sql.unsafe<{ total: number }[]>(countBranchesQuery.query, countBranchesQuery.values),
    ]);

    const totalItems = branchesTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting branches');
    }

    const branchesDB: FindBranchesResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return branchesDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, search, companyId }, 'Error finding branches');
    throw new Error('Error finding branches');
  }
}

const UPDATE_BRANCH_BY_ID_QUERY = (dataDB: UpdateColumnBranchDao[], branch: FindBranchByIdDao) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(branch.suid);
  values.push(branch.suemid);

  const query = `
    update sucursal
    set ${setClause.join(', ')}
    where suid = $${values.length - 1} and suemid = $${values.length}
    returning suid, suemid, sunombre, sudireccion, sucorreo, suidentificador, sufchregistro, suestado
  `;

  return { query, values };
};

async function updateBranchById(dataDB: UpdateColumnBranchDao[], branch: FindBranchByIdDao): Promise<BranchRowDao | null> {
  try {
    const { query, values } = UPDATE_BRANCH_BY_ID_QUERY(dataDB, branch);
    const result = await sql.unsafe<BranchRowDao[]>(query, values);
    const updatedBranch = result[0];

    if (!updatedBranch) {
      return null;
    }

    return updatedBranch;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: branch.suemid,
        branchId: branch.suid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating branch by id',
    );
    throw new Error('Error updating branch by id');
  }
}

export { saveBranch, findBranchByIdentifier, findBranchById, findBranches, updateBranchById };
