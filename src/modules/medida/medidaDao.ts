import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreateMedidaDao = {
  mdiaemid: string;
  mdianombre: string;
  mdiaabreviatura: string;
};

type FindMedidaByIdDao = {
  mdiaemid: string;
  mdiaid: string;
};

type FindMedidaByNameDao = {
  mdiaemid: string;
  mdianombre: string;
};

type FindMedidaByAbbreviationDao = {
  mdiaemid: string;
  mdiaabreviatura: string;
};

type FindMedidasParamsDao = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type UpdateColumnMedidaDao = {
  column: string,
  value: string | number | boolean | Date | null;
}

type MedidaRowDao = {
  mdiaid: string;
  mdiaemid: string;
  mdianombre: string;
  mdiaabreviatura: string;
  mdiafchregistro: Date;
  mdiaestado: Status;
};

type FindMedidasResponseDao = {
  items: MedidaRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_MEDIDA_QUERY = `
  insert into medida (mdiaemid, mdianombre, mdiaabreviatura)
  values ($1, $2, $3)
  returning mdiaid
`;

async function saveMedida(medida: CreateMedidaDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ mdiaid: string }[]>(SAVE_MEDIDA_QUERY, [
      medida.mdiaemid,
      medida.mdianombre,
      medida.mdiaabreviatura,
    ]);

    const medidaDB = result[0];
    if (!medidaDB) {
      throw new Error('Medida was not created');
    }

    logger.info(
      {
        medidaId: medidaDB.mdiaid,
        companyId: medida.mdiaemid,
      },
      'Medida created',
    );

    return medidaDB.mdiaid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: medida.mdiaemid,
      },
      'Error saving medida',
    );
    throw new Error('Error saving medida');
  }
}

const FIND_MEDIDA_BY_ID_QUERY = `
  select mdiaid, mdiaemid, mdianombre, mdiaabreviatura, mdiafchregistro, mdiaestado
  from medida
  where mdiaemid = $1 and mdiaid = $2
`;

async function findMedidaById(medida: FindMedidaByIdDao): Promise<MedidaRowDao | null> {
  try {
    const result = await sql.unsafe<MedidaRowDao[]>(FIND_MEDIDA_BY_ID_QUERY, [
      medida.mdiaemid,
      medida.mdiaid,
    ]);
    const medidaDB = result[0];

    if (!medidaDB) {
      return null;
    }

    return medidaDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: medida.mdiaemid,
        medidaId: medida.mdiaid,
      },
      'Error finding medida by id',
    );
    throw new Error('Error finding medida by id');
  }
}

const FIND_MEDIDA_BY_NAME_QUERY = `
  select mdiaid, mdiaemid, mdianombre, mdiaabreviatura, mdiafchregistro, mdiaestado
  from medida
  where mdiaemid = $1 and lower(trim(mdianombre)) = lower(trim($2))
`;

async function findMedidaByName(medida: FindMedidaByNameDao): Promise<MedidaRowDao | null> {
  try {
    const result = await sql.unsafe<MedidaRowDao[]>(FIND_MEDIDA_BY_NAME_QUERY, [
      medida.mdiaemid,
      medida.mdianombre,
    ]);
    const medidaDB = result[0];

    if (!medidaDB) {
      return null;
    }

    return medidaDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: medida.mdiaemid,
        name: medida.mdianombre,
      },
      'Error finding medida by name',
    );
    throw new Error('Error finding medida by name');
  }
}

const FIND_MEDIDA_BY_ABBREVIATION_QUERY = `
  select mdiaid, mdiaemid, mdianombre, mdiaabreviatura, mdiafchregistro, mdiaestado
  from medida
  where mdiaemid = $1 and lower(trim(mdiaabreviatura)) = lower(trim($2))
`;

async function findMedidaByAbbreviation(medida: FindMedidaByAbbreviationDao): Promise<MedidaRowDao | null> {
  try {
    const result = await sql.unsafe<MedidaRowDao[]>(FIND_MEDIDA_BY_ABBREVIATION_QUERY, [
      medida.mdiaemid,
      medida.mdiaabreviatura,
    ]);
    const medidaDB = result[0];

    if (!medidaDB) {
      return null;
    }

    return medidaDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: medida.mdiaemid,
        abbreviation: medida.mdiaabreviatura,
      },
      'Error finding medida by abbreviation',
    );
    throw new Error('Error finding medida by abbreviation');
  }
}

type MedidaQueryValue = string | number;

function buildFindMedidasWhereClause(
  companyId: string,
  params: Pick<FindMedidasParamsDao, 'search' | 'status'>,
): { clause: string; values: MedidaQueryValue[] } {
  const conditions = ['mdiaemid = $1'];
  const values: MedidaQueryValue[] = [companyId];

  if (params.status) {
    values.push(params.status);
    conditions.push(`mdiaestado = $${values.length}`);
  } else {
    conditions.push(`mdiaestado != 'eliminado'`);
  }

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    const searchParamIndex = values.length;

    conditions.push(`lower(trim(mdianombre)) like $${searchParamIndex}`);
  }

  return {
    clause: conditions.join(' and '),
    values,
  };
}

function buildFindMedidasQuery(
  params: FindMedidasParamsDao,
  companyId: string,
): { query: string; values: MedidaQueryValue[] } {
  const where = buildFindMedidasWhereClause(companyId, params);
  const offset = (params.page - 1) * params.pageSize;
  const values = [...where.values, params.pageSize, offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const query = `
    select mdiaid, mdiaemid, mdianombre, mdiaabreviatura, mdiafchregistro, mdiaestado
    from medida
    where ${where.clause}
    order by mdiafchregistro desc
    limit $${limitParamIndex}
    offset $${offsetParamIndex}
  `;

  return { query, values };
}

function buildCountMedidasQuery(
  params: FindMedidasParamsDao,
  companyId: string,
): { query: string; values: MedidaQueryValue[] } {
  const where = buildFindMedidasWhereClause(companyId, params);
  const query = `
    select count(*)::int as total
    from medida
    where ${where.clause}
  `;

  return { query, values: where.values };
}

async function findMedidas(
  params: FindMedidasParamsDao,
  companyId: string,
): Promise<FindMedidasResponseDao> {
  const { page, pageSize, search } = params;

  try {
    const findMedidasQuery = buildFindMedidasQuery(params, companyId);
    const countMedidasQuery = buildCountMedidasQuery(params, companyId);

    const [result, medidasTotalDB] = await Promise.all([
      sql.unsafe<MedidaRowDao[]>(findMedidasQuery.query, findMedidasQuery.values),
      sql.unsafe<{ total: number }[]>(countMedidasQuery.query, countMedidasQuery.values),
    ]);

    const totalItems = medidasTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting medidas');
    }

    const medidasDB: FindMedidasResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return medidasDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, search, companyId }, 'Error finding medidas');
    throw new Error('Error finding medidas');
  }
}

const UPDATE_MEDIDA_BY_ID_QUERY = (
  dataDB: UpdateColumnMedidaDao[],
  medida: FindMedidaByIdDao,
) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(medida.mdiaid);
  values.push(medida.mdiaemid);

  const query = `
    update medida
    set ${setClause.join(', ')}
    where mdiaid = $${values.length - 1} and mdiaemid = $${values.length}
    returning mdiaid, mdiaemid, mdianombre, mdiaabreviatura, mdiafchregistro, mdiaestado
  `;

  return { query, values };
};

async function updateMedidaById(
  dataDB: UpdateColumnMedidaDao[],
  medida: FindMedidaByIdDao,
): Promise<MedidaRowDao | null> {
  try {
    const { query, values } = UPDATE_MEDIDA_BY_ID_QUERY(dataDB, medida);
    const result = await sql.unsafe<MedidaRowDao[]>(query, values);
    const updatedMedida = result[0];

    if (!updatedMedida) {
      return null;
    }

    return updatedMedida;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: medida.mdiaemid,
        medidaId: medida.mdiaid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating medida by id',
    );
    throw new Error('Error updating medida by id');
  }
}

export {
  saveMedida,
  findMedidaById,
  findMedidaByName,
  findMedidaByAbbreviation,
  findMedidas,
  updateMedidaById,
};
