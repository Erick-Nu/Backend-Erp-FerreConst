import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Status } from '../../config/databaseTypes.js';

type CreateCheckoutDao = {
  cjemid: string;
  cjsuid: string;
  cjidentificador: string;
};

type CheckoutRowDao = {
  cjid: string;
  cjemid: string;
  cjsuid: string;
  cjidentificador: string;
  cjfchregistro: Date;
  cjestado: Status;
};

type FindCheckoutByIdDao = {
  cjemid: string;
  cjsuid: string;
  cjidentificador: string;
};

type FindCheckoutByRowIdDao = {
  cjid: string;
  cjemid: string;
};

type FindCheckoutsParamsDao = {
  page: number;
  pageSize: number;
};

type CheckoutWithBranchRowDao = CheckoutRowDao & {
  suid: string;
  sunombre: string;
  suidentificador: string;
  suestado: Status;
};

type FindCheckoutsResponseDao = {
  items: CheckoutWithBranchRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const SAVE_CHECKOUT_QUERY = `
  insert into caja (cjemid, cjsuid, cjidentificador)
  values ($1, $2, $3)
  returning cjid
`;

async function saveCheckout(checkout: CreateCheckoutDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ cjid: string }[]>(SAVE_CHECKOUT_QUERY, [
      checkout.cjemid,
      checkout.cjsuid,
      checkout.cjidentificador,
    ]);

    const checkoutDB = result[0];
    if (!checkoutDB) {
      throw new Error('Checkout was not created');
    }

    logger.info(
      {
        checkoutId: checkoutDB.cjid,
        companyId: checkout.cjemid,
        branchId: checkout.cjsuid,
      },
      'Checkout created',
    );

    return checkoutDB.cjid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: checkout.cjemid,
        branchId: checkout.cjsuid,
        identifier: checkout.cjidentificador,
      },
      'Error saving checkout',
    );
    throw new Error('Error saving checkout');
  }
}

const FIND_CHECKOUT_BY_ID_QUERY = `
  select
    c.cjid,
    c.cjemid,
    c.cjsuid,
    c.cjidentificador,
    c.cjfchregistro,
    c.cjestado,
    s.suid,
    s.sunombre,
    s.suidentificador,
    s.suestado
  from caja c
  inner join sucursal s on s.suid = c.cjsuid and s.suemid = c.cjemid
  where c.cjemid = $1 and c.cjsuid = $2 and c.cjidentificador = $3
`;

async function findCheckoutById(checkout: FindCheckoutByIdDao): Promise<CheckoutWithBranchRowDao | null> {
  try {
    const result = await sql.unsafe<CheckoutWithBranchRowDao[]>(FIND_CHECKOUT_BY_ID_QUERY, [
      checkout.cjemid,
      checkout.cjsuid,
      checkout.cjidentificador,
    ]);
    const checkoutDB = result[0];

    if (!checkoutDB) {
      return null;
    }

    return checkoutDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: checkout.cjemid,
        branchId: checkout.cjsuid,
        identifier: checkout.cjidentificador,
      },
      'Error finding checkout by id',
    );
    throw new Error('Error finding checkout by id');
  }
}

const FIND_CHECKOUT_BY_ROW_ID_QUERY = `
  select cjid, cjemid, cjsuid, cjidentificador, cjfchregistro, cjestado
  from caja
  where cjid = $1 and cjemid = $2
`;

async function findCheckoutByRowId(checkout: FindCheckoutByRowIdDao): Promise<CheckoutRowDao | null> {
  try {
    const result = await sql.unsafe<CheckoutRowDao[]>(FIND_CHECKOUT_BY_ROW_ID_QUERY, [
      checkout.cjid,
      checkout.cjemid,
    ]);
    const checkoutDB = result[0];

    if (!checkoutDB) {
      return null;
    }

    return checkoutDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        checkoutId: checkout.cjid,
        companyId: checkout.cjemid,
      },
      'Error finding checkout by row id',
    );
    throw new Error('Error finding checkout by row id');
  }
}

const FIND_CHECKOUTS_QUERY = `
  select
    c.cjid,
    c.cjemid,
    c.cjsuid,
    c.cjidentificador,
    c.cjfchregistro,
    c.cjestado,
    s.suid,
    s.sunombre,
    s.suidentificador,
    s.suestado
  from caja c
  inner join sucursal s on s.suid = c.cjsuid and s.suemid = c.cjemid
  where c.cjemid = $1
  order by c.cjfchregistro desc
  limit $2
  offset $3
`;

const COUNT_CHECKOUTS_QUERY = `
  select count(*)::int as total
  from caja
  where cjemid = $1
`;

async function findCheckouts(
  params: FindCheckoutsParamsDao,
  companyId: string,
): Promise<FindCheckoutsResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const result = await sql.unsafe<CheckoutWithBranchRowDao[]>(FIND_CHECKOUTS_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const checkoutsTotalDB = await sql.unsafe<{ total: number }[]>(COUNT_CHECKOUTS_QUERY, [companyId]);
    const totalItems = checkoutsTotalDB[0];

    if (!totalItems) {
      throw new Error('Error counting checkouts');
    }

    const checkoutsDB: FindCheckoutsResponseDao = {
      items: result,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };

    return checkoutsDB;
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding checkouts');
    throw new Error('Error finding checkouts');
  }
}

const UPDATE_CHECKOUT_STATUS_BY_ID_QUERY = `
  with updated_checkout as (
    update caja
    set cjestado = $1
    where cjid = $2 and cjemid = $3
    returning cjid, cjemid, cjsuid, cjidentificador, cjfchregistro, cjestado
  )
  select
    uc.cjid,
    uc.cjemid,
    uc.cjsuid,
    uc.cjidentificador,
    uc.cjfchregistro,
    uc.cjestado,
    s.suid,
    s.sunombre,
    s.suidentificador,
    s.suestado
  from updated_checkout uc
  inner join sucursal s on s.suid = uc.cjsuid and s.suemid = uc.cjemid
`;

async function updateCheckoutStatusById(
  cjestado: Status,
  checkout: FindCheckoutByRowIdDao,
): Promise<CheckoutWithBranchRowDao | null> {
  try {
    const result = await sql.unsafe<CheckoutWithBranchRowDao[]>(UPDATE_CHECKOUT_STATUS_BY_ID_QUERY, [
      cjestado,
      checkout.cjid,
      checkout.cjemid,
    ]);
    const updatedCheckout = result[0];

    if (!updatedCheckout) {
      return null;
    }

    return updatedCheckout;
  } catch (error) {
    logger.error(
      {
        err: error,
        checkoutId: checkout.cjid,
        companyId: checkout.cjemid,
        status: cjestado,
      },
      'Error updating checkout status by id',
    );
    throw new Error('Error updating checkout status by id');
  }
}

export { saveCheckout, findCheckoutById, findCheckoutByRowId, findCheckouts, updateCheckoutStatusById };
