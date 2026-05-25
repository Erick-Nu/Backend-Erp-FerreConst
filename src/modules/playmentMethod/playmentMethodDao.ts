import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreatePlaymentMethodDao = {
  mpemid: string;
  mpnombre: string;
};

type FindPlaymentMethodByIdDao = {
  mpemid: string;
  mpid: string;
};

type FindPlaymentMethodByNameDao = {
  mpemid: string;
  mpnombre: string;
};

type FindPlaymentMethodsParamsDao = {
  page: number;
  pageSize: number;
};

type UpdateColumnPlaymentMethodDao = {
  column: string,
  value: string | number | boolean | Date | null;
}

type PlaymentMethodRowDao = {
  mpid: string;
  mpemid: string;
  mpnombre: string;
  mpfchregistro: Date;
  mpestado: Status;
};

type FindPlaymentMethodsResponseDao = {
  items: PlaymentMethodRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_PLAYMENT_METHOD_QUERY = `
  insert into metodopago (mpemid, mpnombre)
  values ($1, $2)
  returning mpid
`;

async function savePlaymentMethod(playmentMethod: CreatePlaymentMethodDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ mpid: string }[]>(SAVE_PLAYMENT_METHOD_QUERY, [
      playmentMethod.mpemid,
      playmentMethod.mpnombre,
    ]);

    const playmentMethodDB = result[0];
    if (!playmentMethodDB) {
      throw new Error('Playment method was not created');
    }

    logger.info(
      {
        playmentMethodId: playmentMethodDB.mpid,
        companyId: playmentMethod.mpemid,
      },
      'Playment method created',
    );

    return playmentMethodDB.mpid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: playmentMethod.mpemid,
      },
      'Error saving playment method',
    );
    throw new Error('Error saving playment method');
  }
}

const FIND_PLAYMENT_METHOD_BY_ID_QUERY = `
  select mpid, mpemid, mpnombre, mpfchregistro, mpestado
  from metodopago
  where mpemid = $1 and mpid = $2
`;

async function findPlaymentMethodById(
  playmentMethod: FindPlaymentMethodByIdDao,
): Promise<PlaymentMethodRowDao | null> {
  try {
    const result = await sql.unsafe<PlaymentMethodRowDao[]>(FIND_PLAYMENT_METHOD_BY_ID_QUERY, [
      playmentMethod.mpemid,
      playmentMethod.mpid,
    ]);
    const playmentMethodDB = result[0];

    if (!playmentMethodDB) {
      return null;
    }

    return playmentMethodDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: playmentMethod.mpemid,
        playmentMethodId: playmentMethod.mpid,
      },
      'Error finding playment method by id',
    );
    throw new Error('Error finding playment method by id');
  }
}

const FIND_PLAYMENT_METHOD_BY_NAME_QUERY = `
  select mpid, mpemid, mpnombre, mpfchregistro, mpestado
  from metodopago
  where mpemid = $1 and lower(trim(mpnombre)) = lower(trim($2))
`;

async function findPlaymentMethodByName(
  playmentMethod: FindPlaymentMethodByNameDao,
): Promise<PlaymentMethodRowDao | null> {
  try {
    const result = await sql.unsafe<PlaymentMethodRowDao[]>(FIND_PLAYMENT_METHOD_BY_NAME_QUERY, [
      playmentMethod.mpemid,
      playmentMethod.mpnombre,
    ]);
    const playmentMethodDB = result[0];

    if (!playmentMethodDB) {
      return null;
    }

    return playmentMethodDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: playmentMethod.mpemid,
        name: playmentMethod.mpnombre,
      },
      'Error finding playment method by name',
    );
    throw new Error('Error finding playment method by name');
  }
}

const FIND_PLAYMENT_METHODS_QUERY = `
  select mpid, mpemid, mpnombre, mpfchregistro, mpestado
  from metodopago
  where mpemid = $1
  order by mpfchregistro desc
  limit $2
  offset $3
`;

const COUNT_PLAYMENT_METHODS_QUERY = `
  select count(*)::int as total
  from metodopago
  where mpemid = $1
`;

async function findPlaymentMethods(
  params: FindPlaymentMethodsParamsDao,
  companyId: string,
): Promise<FindPlaymentMethodsResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const result = await sql.unsafe<PlaymentMethodRowDao[]>(FIND_PLAYMENT_METHODS_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const playmentMethodsTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_PLAYMENT_METHODS_QUERY, [companyId]);
    const totalItems = playmentMethodsTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting playment methods');
    }

    const playmentMethodsDB: FindPlaymentMethodsResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return playmentMethodsDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding playment methods');
    throw new Error('Error finding playment methods');
  }
}

const UPDATE_PLAYMENT_METHOD_BY_ID_QUERY = (
  dataDB: UpdateColumnPlaymentMethodDao[],
  playmentMethod: FindPlaymentMethodByIdDao,
) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(playmentMethod.mpid);
  values.push(playmentMethod.mpemid);

  const query = `
    update metodopago
    set ${setClause.join(', ')}
    where mpid = $${values.length - 1} and mpemid = $${values.length}
    returning mpid, mpemid, mpnombre, mpfchregistro, mpestado
  `;

  return { query, values };
};

async function updatePlaymentMethodById(
  dataDB: UpdateColumnPlaymentMethodDao[],
  playmentMethod: FindPlaymentMethodByIdDao,
): Promise<PlaymentMethodRowDao | null> {
  try {
    const { query, values } = UPDATE_PLAYMENT_METHOD_BY_ID_QUERY(dataDB, playmentMethod);
    const result = await sql.unsafe<PlaymentMethodRowDao[]>(query, values);
    const updatedPlaymentMethod = result[0];

    if (!updatedPlaymentMethod) {
      return null;
    }

    return updatedPlaymentMethod;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: playmentMethod.mpemid,
        playmentMethodId: playmentMethod.mpid,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating playment method by id',
    );
    throw new Error('Error updating playment method by id');
  }
}

export {
  savePlaymentMethod,
  findPlaymentMethodById,
  findPlaymentMethodByName,
  findPlaymentMethods,
  updatePlaymentMethodById,
};
