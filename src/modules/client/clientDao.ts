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

const FIND_CLIENTS_QUERY = `
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
  where clnteemid = $1
  order by clntefchregistro desc
  limit $2
  offset $3
`;

const COUNT_CLIENTS_QUERY = `
  select count(*)::int as total
  from cliente
  where clnteemid = $1
`;

async function findClients(
  params: FindClientsParamsDao,
  companyId: string,
): Promise<FindClientsResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const result = await sql.unsafe<ClientRowDao[]>(FIND_CLIENTS_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const clientsTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_CLIENTS_QUERY, [companyId]);
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
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding clients');
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
