import { sql } from '../../config/database.js';
import type { Identification, Status } from '../../config/databaseTypes.js';
import { logger } from '../../utils/logger.js';

type CreateClientDao = {
  clnteemid: string;
  clntetipoidentificacion: Identification;
  clnteidentificacion: string;
  clntenombre: string;
  clntecorreo: string;
  clntedireccion: string;
  clntetelefono: string;
};

type FindClientByIdDao = {
  clnteemid: string;
  clnteid: string;
};

type FindClientByIdentificationDao = {
  clnteemid: string;
  clnteidentificacion: string;
};

type FindClientByEmailDao = {
  clnteemid: string;
  clntecorreo: string;
};

type FindClientsParamsDao = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type UpdateColumnClientDao = {
  column: string;
  value: string | number | boolean | Date | null;
};

type ClientRowDao = {
  clnteid: string;
  clnteemid: string;
  clntetipoidentificacion: Identification;
  clnteidentificacion: string;
  clntenombre: string;
  clntecorreo: string;
  clntedireccion: string;
  clntetelefono: string;
  clntefchregistro: Date;
  clnteestado: Status;
};

type FindClientsResponseDao = {
  items: ClientRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_CLIENT_QUERY = `
  insert into cliente (
    clnteemid,
    clntetipoidentificacion,
    clnteidentificacion,
    clntenombre,
    clntecorreo,
    clntedireccion,
    clntetelefono
  )
  values ($1, $2, $3, $4, $5, $6, $7)
  returning clnteid
`;

async function saveClient(client: CreateClientDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ clnteid: string }[]>(SAVE_CLIENT_QUERY, [
      client.clnteemid,
      client.clntetipoidentificacion,
      client.clnteidentificacion,
      client.clntenombre,
      client.clntecorreo,
      client.clntedireccion,
      client.clntetelefono,
    ]);

    const clientDB = result[0];
    if (!clientDB) {
      throw new Error('Client was not created');
    }

    logger.info(
      {
        clientId: clientDB.clnteid,
        companyId: client.clnteemid,
      },
      'Client created',
    );

    return clientDB.clnteid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: client.clnteemid,
      },
      'Error saving client',
    );
    throw new Error('Error saving client');
  }
}

const FIND_CLIENT_BY_ID_QUERY = `
  select
    clnteid,
    clnteemid,
    clntetipoidentificacion,
    clnteidentificacion,
    clntenombre,
    clntecorreo,
    clntedireccion,
    clntetelefono,
    clntefchregistro,
    clnteestado
  from cliente
  where clnteemid = $1 and clnteid = $2
`;

async function findClientById(client: FindClientByIdDao): Promise<ClientRowDao | null> {
  try {
    const result = await sql.unsafe<ClientRowDao[]>(FIND_CLIENT_BY_ID_QUERY, [
      client.clnteemid,
      client.clnteid,
    ]);
    const clientDB = result[0];

    if (!clientDB) {
      return null;
    }

    return clientDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: client.clnteemid,
        clientId: client.clnteid,
      },
      'Error finding client by id',
    );
    throw new Error('Error finding client by id');
  }
}

const FIND_CLIENT_BY_IDENTIFICATION_QUERY = `
  select
    clnteid,
    clnteemid,
    clntetipoidentificacion,
    clnteidentificacion,
    clntenombre,
    clntecorreo,
    clntedireccion,
    clntetelefono,
    clntefchregistro,
    clnteestado
  from cliente
  where clnteemid = $1 and clnteidentificacion = $2
`;

async function findClientByIdentification(
  client: FindClientByIdentificationDao,
): Promise<ClientRowDao | null> {
  try {
    const result = await sql.unsafe<ClientRowDao[]>(FIND_CLIENT_BY_IDENTIFICATION_QUERY, [
      client.clnteemid,
      client.clnteidentificacion,
    ]);
    const clientDB = result[0];

    if (!clientDB) {
      return null;
    }

    return clientDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: client.clnteemid,
        identification: client.clnteidentificacion,
      },
      'Error finding client by identification',
    );
    throw new Error('Error finding client by identification');
  }
}

const FIND_CLIENT_BY_EMAIL_QUERY = `
  select
    clnteid,
    clnteemid,
    clntetipoidentificacion,
    clnteidentificacion,
    clntenombre,
    clntecorreo,
    clntedireccion,
    clntetelefono,
    clntefchregistro,
    clnteestado
  from cliente
  where clnteemid = $1 and lower(trim(clntecorreo)) = lower(trim($2))
`;

type ClientQueryValue = string | number;

function buildFindClientsWhereClause(
  companyId: string,
  params: Pick<FindClientsParamsDao, 'search' | 'status'>,
): { clause: string; values: ClientQueryValue[] } {
  const conditions = ['clnteemid = $1'];
  const values: ClientQueryValue[] = [companyId];

  if (params.status) {
    values.push(params.status);
    conditions.push(`clnteestado = $${values.length}`);
  } else {
    conditions.push(`clnteestado != 'eliminado'`);
  }

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    const searchParamIndex = values.length;

    conditions.push(`(
      lower(trim(clntenombre)) like $${searchParamIndex}
      or lower(trim(clnteidentificacion)) like $${searchParamIndex}
    )`);
  }

  return {
    clause: conditions.join(' and '),
    values,
  };
}

function buildFindClientsQuery(
  params: FindClientsParamsDao,
  companyId: string,
): { query: string; values: ClientQueryValue[] } {
  const where = buildFindClientsWhereClause(companyId, params);
  const offset = (params.page - 1) * params.pageSize;
  const values = [...where.values, params.pageSize, offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const query = `
    select
      clnteid,
      clnteemid,
      clntetipoidentificacion,
      clnteidentificacion,
      clntenombre,
      clntecorreo,
      clntedireccion,
      clntetelefono,
      clntefchregistro,
      clnteestado
    from cliente
    where ${where.clause}
    order by clntefchregistro desc
    limit $${limitParamIndex}
    offset $${offsetParamIndex}
  `;

  return { query, values };
}

function buildCountClientsQuery(
  params: FindClientsParamsDao,
  companyId: string,
): { query: string; values: ClientQueryValue[] } {
  const where = buildFindClientsWhereClause(companyId, params);
  const query = `
    select count(*)::int as total
    from cliente
    where ${where.clause}
  `;

  return { query, values: where.values };
}

async function findClientByEmail(client: FindClientByEmailDao): Promise<ClientRowDao | null> {
  try {
    const result = await sql.unsafe<ClientRowDao[]>(FIND_CLIENT_BY_EMAIL_QUERY, [
      client.clnteemid,
      client.clntecorreo,
    ]);
    const clientDB = result[0];

    if (!clientDB) {
      return null;
    }

    return clientDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: client.clnteemid,
        email: client.clntecorreo,
      },
      'Error finding client by email',
    );
    throw new Error('Error finding client by email');
  }
}

async function findClients(
  params: FindClientsParamsDao,
  companyId: string,
): Promise<FindClientsResponseDao> {
  const { page, pageSize, search } = params;

  try {
    const findClientsQuery = buildFindClientsQuery(params, companyId);
    const countClientsQuery = buildCountClientsQuery(params, companyId);

    const [result, clientsTotalDB] = await Promise.all([
      sql.unsafe<ClientRowDao[]>(findClientsQuery.query, findClientsQuery.values),
      sql.unsafe<{ total: number }[]>(countClientsQuery.query, countClientsQuery.values),
    ]);

    const totalItems = clientsTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting clients');
    }

    const clientsDB: FindClientsResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return clientsDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, search, companyId }, 'Error finding clients');
    throw new Error('Error finding clients');
  }
}

const UPDATE_CLIENT_BY_ID_QUERY = (
  dataDB: UpdateColumnClientDao[],
  client: FindClientByIdDao,
) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(client.clnteid);
  values.push(client.clnteemid);

  const query = `
    update cliente
    set ${setClause.join(', ')}
    where clnteid = $${values.length - 1} and clnteemid = $${values.length}
    returning
      clnteid,
      clnteemid,
      clntetipoidentificacion,
      clnteidentificacion,
      clntenombre,
      clntecorreo,
      clntedireccion,
      clntetelefono,
      clntefchregistro,
      clnteestado
  `;

  return { query, values };
};

async function updateClientById(
  dataDB: UpdateColumnClientDao[],
  client: FindClientByIdDao,
): Promise<ClientRowDao | null> {
  try {
    const { query, values } = UPDATE_CLIENT_BY_ID_QUERY(dataDB, client);
    const result = await sql.unsafe<ClientRowDao[]>(query, values);
    const updatedClient = result[0];

    if (!updatedClient) {
      return null;
    }

    return updatedClient;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: client.clnteemid,
        clientId: client.clnteid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating client by id',
    );
    throw new Error('Error updating client by id');
  }
}

export {
  saveClient,
  findClientById,
  findClientByIdentification,
  findClientByEmail,
  findClients,
  updateClientById,
};

export type {
  ClientRowDao,
  FindClientsResponseDao,
};
