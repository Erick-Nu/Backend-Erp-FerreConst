import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreateProveedorDao = {
  provemid: string;
  provctgriaid: string | null;
  provmrcid: string | null;
  provnombre: string;
  provtelefono: string;
  provcorreo: string | null;
};

type FindProveedorByIdDao = {
  provemid: string;
  provid: string;
};

type FindProveedorByNameDao = {
  provemid: string;
  provnombre: string;
};

type FindProveedoresParamsDao = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type UpdateColumnProveedorDao = {
  column: string,
  value: string | number | boolean | Date | null;
}

type ProveedorRowDao = {
  provid: string;
  provemid: string;
  provctgriaid: string | null;
  provmrcid: string | null;
  provnombre: string;
  provtelefono: string;
  provcorreo: string | null;
  provfchregistro: Date;
  provestado: Status;
  ctgnombre?: string | null;
  ctgriadescripcion?: string | null;
  mrcnombre?: string | null;
};

type FindProveedoresResponseDao = {
  items: ProveedorRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type UpdateProveedorIdDao = {
  provid: string;
};

const SAVE_PROVEEDOR_QUERY = `
  insert into proveedor (provemid, provctgriaid, provmrcid, provnombre, provtelefono, provcorreo)
  values ($1, $2, $3, $4, $5, $6)
  returning provid
`;

async function saveProveedor(proveedor: CreateProveedorDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ provid: string }[]>(SAVE_PROVEEDOR_QUERY, [
      proveedor.provemid,
      proveedor.provctgriaid,
      proveedor.provmrcid,
      proveedor.provnombre,
      proveedor.provtelefono,
      proveedor.provcorreo,
    ]);

    const proveedorDB = result[0];
    if (!proveedorDB) {
      throw new Error('El proveedor no fue creado');
    }

    logger.info(
      {
        proveedorId: proveedorDB.provid,
        companyId: proveedor.provemid,
      },
      'Proveedor created',
    );

    return proveedorDB.provid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proveedor.provemid,
      },
      'Error saving proveedor',
    );
    throw new Error('Error saving proveedor');
  }
}

const FIND_PROVEEDOR_BY_ID_QUERY = `
  select
    p.provid,
    p.provemid,
    p.provctgriaid,
    p.provmrcid,
    p.provnombre,
    p.provtelefono,
    p.provcorreo,
    p.provfchregistro,
    p.provestado,
    c.ctgnombre,
    c.ctgriadescripcion,
    m.mrcnombre
  from proveedor p
  left join categoria c
    on c.ctgriaid = p.provctgriaid
    and c.ctgriaemid = p.provemid
  left join marca m
    on m.mrcid = p.provmrcid
    and m.mrcemid = p.provemid
  where p.provid = $1 and p.provemid = $2;
`;

async function findProveedorById(proveedor: FindProveedorByIdDao): Promise<ProveedorRowDao | null> {
  try {
    const result = await sql.unsafe<ProveedorRowDao[]>(FIND_PROVEEDOR_BY_ID_QUERY, [
      proveedor.provid,
      proveedor.provemid,
    ]);
    const proveedorDB = result[0];

    if (!proveedorDB) {
      return null;
    }

    return proveedorDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proveedor.provemid,
        proveedorId: proveedor.provid,
      },
      'Error finding proveedor by id',
    );
    throw new Error('Error finding proveedor by id');
  }
}

const FIND_PROVEEDOR_BY_NAME_QUERY = `
  select provid from proveedor
  where provemid = $1 and lower(trim(provnombre)) = lower(trim($2))
`;

async function findProveedorByName(proveedor: FindProveedorByNameDao): Promise<ProveedorRowDao | null> {
  try {
    const result = await sql.unsafe<ProveedorRowDao[]>(FIND_PROVEEDOR_BY_NAME_QUERY, [
      proveedor.provemid,
      proveedor.provnombre,
    ]);
    const proveedorDB = result[0];

    if (!proveedorDB) {
      return null;
    }

    return proveedorDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proveedor.provemid,
        name: proveedor.provnombre,
      },
      'Error finding proveedor by name',
    );
    throw new Error('Error finding proveedor by name');
  }
}

type ProveedorQueryValue = string | number;

function buildFindProveedoresWhereClause(
  companyId: string,
  params: Pick<FindProveedoresParamsDao, 'search' | 'status'>,
): { clause: string; values: ProveedorQueryValue[] } {
  const conditions = ['p.provemid = $1'];
  const values: ProveedorQueryValue[] = [companyId];

  if (params.status) {
    values.push(params.status);
    conditions.push(`p.provestado = $${values.length}`);
  } else {
    conditions.push(`p.provestado != 'eliminado'`);
  }

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    const searchParamIndex = values.length;

    conditions.push(`(
      lower(trim(p.provnombre)) like $${searchParamIndex}
      or lower(trim(p.provcorreo)) like $${searchParamIndex}
    )`);
  }

  return {
    clause: conditions.join(' and '),
    values,
  };
}

function buildFindProveedoresQuery(
  params: FindProveedoresParamsDao,
  companyId: string,
): { query: string; values: ProveedorQueryValue[] } {
  const where = buildFindProveedoresWhereClause(companyId, params);
  const offset = (params.page - 1) * params.pageSize;
  const values = [...where.values, params.pageSize, offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const query = `
    select
      p.provid,
      p.provemid,
      p.provctgriaid,
      p.provmrcid,
      p.provnombre,
      p.provtelefono,
      p.provcorreo,
      p.provfchregistro,
      p.provestado,
      c.ctgnombre,
      c.ctgriadescripcion,
      m.mrcnombre
    from proveedor p
    left join categoria c
      on c.ctgriaid = p.provctgriaid
      and c.ctgriaemid = p.provemid
    left join marca m
      on m.mrcid = p.provmrcid
      and m.mrcemid = p.provemid
    where ${where.clause}
    order by p.provfchregistro desc
    limit $${limitParamIndex}
    offset $${offsetParamIndex}
  `;

  return { query, values };
}

function buildCountProveedoresQuery(
  params: FindProveedoresParamsDao,
  companyId: string,
): { query: string; values: ProveedorQueryValue[] } {
  const where = buildFindProveedoresWhereClause(companyId, params);
  const query = `
    select count(*)::int as total
    from proveedor p
    where ${where.clause}
  `;

  return { query, values: where.values };
}

async function findProveedores(
  params: FindProveedoresParamsDao,
  companyId: string,
): Promise<FindProveedoresResponseDao> {
  const { page, pageSize, search } = params;

  try {
    const findProveedoresQuery = buildFindProveedoresQuery(params, companyId);
    const countProveedoresQuery = buildCountProveedoresQuery(params, companyId);

    const [result, proveedoresTotalDB] = await Promise.all([
      sql.unsafe<ProveedorRowDao[]>(findProveedoresQuery.query, findProveedoresQuery.values),
      sql.unsafe<{ total: number }[]>(countProveedoresQuery.query, countProveedoresQuery.values),
    ]);

    const totalItems = proveedoresTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting proveedores');
    }

    const proveedoresDB: FindProveedoresResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return proveedoresDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, search, companyId }, 'Error finding proveedores');
    throw new Error('Error finding proveedores');
  }
}

const UPDATE_PROVEEDOR_BY_ID_QUERY = (
  dataDB: UpdateColumnProveedorDao[],
  proveedor: FindProveedorByIdDao,
) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(proveedor.provid);
  values.push(proveedor.provemid);

  const query = `
    update proveedor
    set ${setClause.join(', ')}
    where provid = $${values.length - 1} and provemid = $${values.length}
    returning provid
  `;

  return { query, values };
};

async function updateProveedorById(
  dataDB: UpdateColumnProveedorDao[],
  proveedor: FindProveedorByIdDao,
): Promise<string | null> {
  try {
    const { query, values } = UPDATE_PROVEEDOR_BY_ID_QUERY(dataDB, proveedor);
    const result = await sql.unsafe<UpdateProveedorIdDao[]>(query, values);
    const updatedProveedor = result[0];

    if (!updatedProveedor) {
      return null;
    }

    return updatedProveedor.provid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proveedor.provemid,
        proveedorId: proveedor.provid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating proveedor by id',
    );
    throw new Error('Error updating proveedor by id');
  }
}

export {
  saveProveedor,
  findProveedorById,
  findProveedorByName,
  findProveedores,
  updateProveedorById,
};

export type {
  ProveedorRowDao,
  FindProveedoresResponseDao,
};
