import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';
import type { CompanyModel } from './companyModel.js';

type CreateCompanyDao = {
  emruc: string;
  emrznsocial: string;
  emcorreo: string;
  emlogo: string;
  emcodigo: string;
};

type CompanyRowDao = {
  emid: string;
  emruc: string;
  emrznsocial: string;
  emcorreo: string;
  emlogo: string;
  emcodigo: string;
  emfchregistro: Date;
  emestado: Status;
};

type UpdateStatusCompanyDao = {
  emid: string;
  emestado: Status;
};

type UpdateColumnCompanyDao = {
  column: string,
  value: string | number | boolean | Date;
}

type FindCompaniesParamsDao = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type FindCompaniesResponseDao = {
  items: CompanyRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type CompanyQueryValue = string | number;


const SAVE_COMPANY_QUERY = `
  insert into empresa (emruc, emrznsocial, emcorreo, emlogo, emcodigo)
  values ($1, $2, $3, $4, $5) returning emid
`;

async function saveCompany(company: CreateCompanyDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ emid: string }[]>(SAVE_COMPANY_QUERY, [
      company.emruc,
      company.emrznsocial,
      company.emcorreo,
      company.emlogo,
      company.emcodigo,
    ]);

    const companyDB = result[0];
    if (!companyDB) {
      throw new Error('La empresa no fue creada');
    }

    logger.info({ companyId: companyDB.emid, ruc: company.emruc }, 'Company created');

    return companyDB.emid;
  } catch (error) {
    logger.error({ err: error, ruc: company.emruc }, 'Error saving company');
    throw new Error('Error saving company');
  }
}

const FIND_COMPANY_BY_RUC_QUERY = `select emid from empresa where emruc = $1`;

async function findCompanyByRuc(ruc: string): Promise<string | null> {
  try {
    const result = await sql.unsafe<{ emid: string }[]>(FIND_COMPANY_BY_RUC_QUERY, [ruc]);
    const rucDB = result[0];

    if (!rucDB) {
      return null;
    }

    return rucDB.emid;
  } catch (error) {
    logger.error({ err: error, ruc }, 'Error finding company by ruc');
    throw new Error('Error finding company by ruc');
  }
}

const FIND_COMAPNY_BY_EMAIL_QUERY = `select emid from empresa where emcorreo = $1`;

async function findCompanyByEmail(email: string): Promise<string | null> {
  try {
    const result = await sql.unsafe<{ emid: string }[]>(FIND_COMAPNY_BY_EMAIL_QUERY, [email]);
    const emailDB = result[0];

    if (!emailDB) {
      return null;
    }

    return emailDB.emid;
  } catch (error) {
    logger.error({ err: error, email }, 'Error finding company by email');
    throw new Error('Error finding company by email');
  }
}

const FIND_COMAPNY_BY_CODE_QUERY = `select emid from empresa where emcodigo = $1`;

async function findCompanyByCode(code: string): Promise<string | null> {
  try {
    const result = await sql.unsafe<{ emid: string }[]>(FIND_COMAPNY_BY_CODE_QUERY, [code]);
    const codeDB = result[0];

    if (!codeDB) {
      return null;
    }

    return codeDB.emid;
  } catch (error) {
    logger.error({ err: error, code }, 'Error finding company by code');
    throw new Error('Error finding company by code');
  }
}

const FIND_COMPANY_BY_ID_QUERY = `
  select emid, emruc, emrznsocial, emcorreo, emlogo, emcodigo, emfchregistro, emestado, empadre
  from empresa
  where emid = $1
`;

async function findCompanyById(id: string): Promise<CompanyModel | null> {
  try {
    const result = await sql.unsafe<CompanyModel[]>(FIND_COMPANY_BY_ID_QUERY, [id]);
    const companyDB = result[0];

    if (!companyDB) {
      return null;
    }

    return companyDB;
  } catch (error) {
    logger.error({ err: error, id }, 'Error finding company by id');
    throw new Error('Error finding company by id');
  }
}

const FIND_COMPANIES_QUERY = `
  select emid, emruc, emrznsocial, emcorreo, emlogo, emcodigo, emfchregistro, emestado
  from empresa
  where empadre = false
  order by emfchregistro desc
  limit $1
  offset $2
`;

const COUNT_COMPANIES_QUERY = `
  select count(*)::int as total
  from empresa
  where empadre = false
`;

function buildFindCompaniesWhereClause(
  params: Pick<FindCompaniesParamsDao, 'search' | 'status'>,
): { clause: string; values: CompanyQueryValue[] } {
  const conditions = ['empadre = false'];
  const values: CompanyQueryValue[] = [];

  if (params.status) {
    values.push(params.status);
    conditions.push(`emestado = $${values.length}`);
  } else {
    conditions.push(`emestado != 'eliminado'`);
  }

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    const searchParamIndex = values.length;

    conditions.push(`(
      lower(trim(emrznsocial)) like $${searchParamIndex}
      or lower(trim(emruc)) like $${searchParamIndex}
      or lower(trim(emcorreo)) like $${searchParamIndex}
      or lower(trim(emcodigo)) like $${searchParamIndex}
    )`);
  }

  return {
    clause: conditions.join(' and '),
    values,
  };
}

function buildFindCompaniesQuery(
  params: FindCompaniesParamsDao,
): { query: string; values: CompanyQueryValue[] } {
  const where = buildFindCompaniesWhereClause(params);
  const offset = (params.page - 1) * params.pageSize;
  const values = [...where.values, params.pageSize, offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const query = `
    select emid, emruc, emrznsocial, emcorreo, emlogo, emcodigo, emfchregistro, emestado
    from empresa
    where ${where.clause}
    order by emfchregistro desc
    limit $${limitParamIndex}
    offset $${offsetParamIndex}
  `;

  return { query, values };
}

function buildCountCompaniesQuery(
  params: FindCompaniesParamsDao,
): { query: string; values: CompanyQueryValue[] } {
  const where = buildFindCompaniesWhereClause(params);

  const query = `
    select count(*)::int as total
    from empresa
    where ${where.clause}
  `;

  return { query, values: where.values };
}

async function findCompanies(params: FindCompaniesParamsDao): Promise<FindCompaniesResponseDao> {
  const { page, pageSize, search } = params;

  try {
    const findCompaniesQuery = buildFindCompaniesQuery(params);
    const countCompaniesQuery = buildCountCompaniesQuery(params);

    const [result, companiesTotalDB] = await Promise.all([
      sql.unsafe<CompanyRowDao[]>(findCompaniesQuery.query, findCompaniesQuery.values),
      sql.unsafe<{ total: number }[]>(countCompaniesQuery.query, countCompaniesQuery.values),
    ]);

    const totalItems = companiesTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting companies');
    }

    const companiesDB: FindCompaniesResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return companiesDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, search }, 'Error finding companies');
    throw new Error('Error finding companies');
  }
}

const UPDATE_COMPANY_STATUS_QUERY = `
  update empresa
  set emestado = $1
  where emid = $2
  returning emid
`;

async function updateCompanyStatus(company: UpdateStatusCompanyDao): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ emid: string }[]>(UPDATE_COMPANY_STATUS_QUERY, [
      company.emestado,
      company.emid,
    ]);
    const updatedCompany = result[0];
    
    if (!updatedCompany) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error, companyId: company.emid }, 'Error updating company status');
    throw new Error('Error updating company status');
  }
}


const UPDATE_COMPANY_BY_ID_QUERY = (dataDB: UpdateColumnCompanyDao[], companyId: string) => {
  if (dataDB.length === 0) {
    throw new Error('No hay columnas para actualizar');
  }

  const setClause = dataDB.map((col, index) => `${col.column} = $${index + 1}`);
  const values = dataDB.map((col) => col.value);
  values.push(companyId);
  
  const query = `
    UPDATE empresa
    SET ${setClause.join(', ')}
    WHERE emid = $${values.length}
    returning emid, emruc, emrznsocial, emcorreo, emlogo, emcodigo, emfchregistro, emestado
  `;

  return { query, values };
};

async function updateCompanyById(dataDB: UpdateColumnCompanyDao[], companyId: string): Promise<CompanyRowDao | null> {
  try {
    const { query, values } = UPDATE_COMPANY_BY_ID_QUERY(dataDB, companyId);
    const result = await sql.unsafe<CompanyRowDao[]>(query, values);
    const updatedCompany = result[0];

    if (!updatedCompany) {
      return null;
    }

    return updatedCompany;
  } catch (error) {
    logger.error(
      { err: error, companyId, columns: dataDB.map((column) => column.column) },
      'Error updating company by id',
    );
    throw new Error('Error updating company by id');
  }
}

export {
  saveCompany,
  findCompanyByRuc,
  findCompanyByEmail,
  findCompanyByCode,
  findCompanyById,
  findCompanies,
  updateCompanyStatus,
  updateCompanyById
};
