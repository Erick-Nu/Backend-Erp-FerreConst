import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Role, Status } from '../../config/databaseTypes.js';

type CreateUserDao = {
  usemid: string;
  usnombre: string;
  usapodo: string;
  uscorreo: string;
  uspassword: string;
  usimagen: string;
  usrol: Role;
};

type UserRowDao = {
  usid: string;
  usemid: string;
  usnombre: string;
  usapodo: string;
  uscorreo: string;
  usimagen: string;
  usrol: Role;
  usfchregistro: Date;
  usestado: Status;
};

type FindUsersParamsDao = {
  page: number;
  pageSize: number;
};

type FindUsersResponseDao = {
  items: UserRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type UpdateStatusUserDao = {
  usid: string;
  usemid: string;
  usestado: Status;
};

type UpdateColumnUserDao = {
  column: string,
  value: string | number | boolean | Date;
}

type FindUserByIdDao = {
  usid: string;
  usemid: string;
};

type FindUserByNicknameDao = {
  usemid: string;
  usapodo: string;
};


const SAVE_USER_QUERY = `
  insert into usuario (usemid, usnombre, usapodo, uscorreo, uspassword, usimagen, usrol)
  values ($1, $2, $3, $4, $5, $6, $7) returning usid
`;

async function saveUser(user: CreateUserDao): Promise<string> {
  try {
    const result = await sql.unsafe<{usid: string}[]>(SAVE_USER_QUERY, [
      user.usemid,
      user.usnombre,
      user.usapodo,
      user.uscorreo,
      user.uspassword,
      user.usimagen,
      user.usrol,
    ]);

    const userDB = result[0];
      
    if (!userDB ) {
      throw new Error('User was not created');
    }

    logger.info({ userId: userDB.usid, companyId: user.usemid }, 'User created');

    return userDB.usid;
      
  } catch (error) {
    logger.error({ err: error, companyId: user.usemid, email: user.uscorreo }, 'Error saving user');
    throw new Error('Error saving user');
  }
}

const FIND_USER_BY_EMAIL_QUERY = `select usid from usuario where uscorreo = $1`;

async function findUserByEmail(email: string): Promise<string| null> {
  try {
    const result = await sql.unsafe<{ usid: string }[]>(FIND_USER_BY_EMAIL_QUERY, [email]);
    const emailDB = result[0];
    if (!emailDB) {
      return null;
    }
    return emailDB.usid
  } catch (error) {
    logger.error({ err: error, email }, 'Error finding user by email');
    throw new Error('Error finding user by email');
  }
}

const FIND_USER_BY_APODO_QUERY = `
  select usid
  from usuario
  where usemid = $1
    and lower(trim(usapodo)) = lower(trim($2))
`;

async function findUserByNickname(user: FindUserByNicknameDao): Promise<string| null> {
  try {
    const result = await sql.unsafe<{ usid: string }[]>(FIND_USER_BY_APODO_QUERY, [
      user.usemid,
      user.usapodo,
    ]);
    const apodoDB = result[0];
    if (!apodoDB) {
      return null;
    }
    return apodoDB.usid
  } catch (error) {
    logger.error(
      { err: error, companyId: user.usemid, nickname: user.usapodo },
      'Error finding user by apodo and company',
    );
    throw new Error('Error finding user by apodo');
  }
}

const FIND_USER_BY_ID_QUERY = `
  select usid, usemid, usnombre, usapodo, uscorreo, usimagen, usrol, usfchregistro, usestado
  from usuario
  where usid = $1 and usemid = $2
`;

async function findUserById(user: FindUserByIdDao): Promise<UserRowDao | null> {
  try {
    const result = await sql.unsafe<UserRowDao[]>(FIND_USER_BY_ID_QUERY, [user.usid, user.usemid]);
    const userDB = result[0];
    if (!userDB) {
      return null;
    }
    return userDB
  } catch (error) {
    logger.error({ err: error, userId: user.usid, companyId: user.usemid }, 'Error finding user by id and company');
    throw new Error('Error finding user by id and company');
  }
}

const FIND_USERS_QUERY = `
  select usid, usemid, usnombre, usapodo, uscorreo, usimagen, usrol, usfchregistro, usestado
  from usuario
  where usemid = $1
  order by usfchregistro desc
  limit $2
  offset $3
`;

const COUNT_USERS_QUERY = `
  select count(*)::int as total
  from usuario
  where usemid = $1
`;

async function findUsers(
  params: FindUsersParamsDao,
  companyId: string,
): Promise<FindUsersResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;
  try {
    const result = await sql.unsafe<UserRowDao[]>(FIND_USERS_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const usersTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_USERS_QUERY, [companyId]);
    const totalItems = usersTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting users');
    }

    const usersDB: FindUsersResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return usersDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding users');
    throw new Error('Error finding users');
  }
}

const UPDATE_USER_STATUS_QUERY = `
  update usuario
  set usestado = $1
  where usid = $2 and usemid = $3
  returning usid
`;

async function updateUserStatus(user: UpdateStatusUserDao): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ usid: string }[]>(UPDATE_USER_STATUS_QUERY, [
      user.usestado,
      user.usid,
      user.usemid,
    ]);
    const updatedUser = result[0];

    if (!updatedUser) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error, userId: user.usid, companyId: user.usemid }, 'Error updating user status');
    throw new Error('Error updating user status');
  }
}

const UPDATE_USER_BY_ID_QUERY = (dataDB: UpdateColumnUserDao[],user: FindUserByIdDao) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(user.usid);
  values.push(user.usemid);

  const query = `
    update usuario
    set ${setClause.join(', ')}
    where usid = $${values.length - 1} and usemid = $${values.length}
    returning usid, usemid, usnombre, usapodo, uscorreo, usimagen, usrol, usfchregistro, usestado
  `;

  return { query, values };
};

async function updateUserById(dataDB: UpdateColumnUserDao[], user: FindUserByIdDao): Promise<UserRowDao | null> {
  try {
    const { query, values } = UPDATE_USER_BY_ID_QUERY(dataDB, user);
    const result = await sql.unsafe<UserRowDao[]>(query, values);
    const updatedUser = result[0];

    if (!updatedUser) {
      return null;
    }

    return updatedUser;
  } catch (error) {
    logger.error(
      { err: error, userId: user.usid, companyId: user.usemid, columns: dataDB.map((column) => column.column) },
      'Error updating user by id',
    );
    throw new Error('Error updating user by id');
  }
}

export {
  saveUser,
  findUserByEmail,
  findUserByNickname,
  findUserById,
  findUsers,
  updateUserStatus,
  updateUserById,
};
