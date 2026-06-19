import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Config } from './configModel.js';

type CreateConfigDao = {
  cfemid: string;
  cfclave: string;
  cfvalor: string;
};

type FindConfigByKeyDao = {
  cfemid: string;
  cfclave: string;
};

type UpdateColumnConfigDao = {
  column: string,
  value: string | number | boolean | Date;
}

const SAVE_CONFIG_QUERY = `
  insert into configuracion (cfemid, cfclave, cfvalor)
  values ($1, $2, $3)
  returning cfid
`;

async function saveConfig(config: CreateConfigDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ cfid: string }[]>(SAVE_CONFIG_QUERY, [
      config.cfemid,
      config.cfclave,
      config.cfvalor,
    ]);

    const configDB = result[0];
    if (!configDB) {
      throw new Error('La configuracion no fue creada');
    }

    logger.info(
      {
        configId: configDB.cfid,
        companyId: config.cfemid,
        key: config.cfclave,
      },
      'Config created',
    );

    return configDB.cfid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: config.cfemid,
        key: config.cfclave,
      },
      'Error saving config',
    );
    throw new Error('Error saving config');
  }
}

const FIND_CONFIG_BY_KEY_QUERY = `
  select cfid, cfemid, cfclave, cfvalor
  from configuracion
  where cfemid = $1 and lower(trim(cfclave)) = lower(trim($2))
`;

async function findConfigByKey(config: FindConfigByKeyDao): Promise<Config | null> {
  try {
    const result = await sql.unsafe<Config[]>(FIND_CONFIG_BY_KEY_QUERY, [config.cfemid, config.cfclave]);
    const configDB = result[0];

    if (!configDB) {
      return null;
    }

    return configDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: config.cfemid,
        key: config.cfclave,
      },
      'Error finding config by key',
    );
    throw new Error('Error finding config by key');
  }
}

const FIND_CONFIGS_QUERY = `
  select cfid, cfemid, cfclave, cfvalor
  from configuracion
  where cfemid = $1
  order by cfclave asc
`;

async function findConfigs(companyId: string): Promise<Config[]> {
  try {
    const result = await sql.unsafe<Config[]>(FIND_CONFIGS_QUERY, [companyId]);
    return result;
  } catch (error) {
    logger.error({ err: error, companyId }, 'Error finding configs');
    throw new Error('Error finding configs');
  }
}

const UPDATE_CONFIG_BY_KEY_QUERY = (dataDB: UpdateColumnConfigDao[], config: FindConfigByKeyDao) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(config.cfclave);
  values.push(config.cfemid);

  const query = `
    update configuracion
    set ${setClause.join(', ')}
    where lower(trim(cfclave)) = lower(trim($${values.length - 1})) and cfemid = $${values.length}
    returning cfid, cfemid, cfclave, cfvalor
  `;

  return { query, values };
};

async function updateConfigByKey(
  dataDB: UpdateColumnConfigDao[],
  config: FindConfigByKeyDao,
): Promise<Config | null> {
  try {
    const { query, values } = UPDATE_CONFIG_BY_KEY_QUERY(dataDB, config);
    const result = await sql.unsafe<Config[]>(query, values);
    const updatedConfig = result[0];

    if (!updatedConfig) {
      return null;
    }

    return updatedConfig;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: config.cfemid,
        key: config.cfclave,
        columns: dataDB.map((column) => column.column),
      },
      'Error updating config by key',
    );
    throw new Error('Error updating config by key');
  }
}

const DELETE_CONFIG_BY_KEY_QUERY = `
  delete from configuracion
  where lower(trim(cfclave)) = lower(trim($1)) and cfemid = $2
  returning cfid, cfemid, cfclave, cfvalor
`;

async function deleteConfigByKey(config: FindConfigByKeyDao): Promise<Config | null> {
  try {
    const result = await sql.unsafe<Config[]>(DELETE_CONFIG_BY_KEY_QUERY, [config.cfclave, config.cfemid]);
    const deletedConfig = result[0];

    if (!deletedConfig) {
      return null;
    }

    return deletedConfig;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: config.cfemid,
        key: config.cfclave,
      },
      'Error deleting config by key',
    );
    throw new Error('Error deleting config by key');
  }
}

export { saveConfig, findConfigByKey, findConfigs, updateConfigByKey, deleteConfigByKey };
