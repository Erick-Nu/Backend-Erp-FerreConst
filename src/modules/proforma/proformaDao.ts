import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { ProformaStatus } from '../../config/databaseTypes.js';

type CreateProformaHeaderDao = {
  prfmaemid: string;
  prfmasuid: string;
  prfmacjid: string;
  prfmausid: string;
  prfmaclnteid: string;
  prfmampid: string;
  prfmaidentificador: string;
  prfmasubtotal: number;
  prfmadescuento: number;
  prfmatotal: number;
};

type CreateProformaItemDao = {
  dprfmaprfmaid: string;
  dprfmaesinventariable: boolean;
  dprfmacodigo: string | null;
  dprfmadescripcion: string;
  dprfmacantidad: number;
  dprfmapreciounitario: number;
  dprfmapreciototal: number;
};

type ReplaceCompleteProformaItemDao = {
  dprfmaid?: string;
  dprfmaesinventariable: boolean;
  dprfmacodigo: string | null;
  dprfmadescripcion: string;
  dprfmacantidad: number;
  dprfmapreciounitario: number;
  dprfmapreciototal: number;
};

type ReplaceCompleteProformaDao = {
  prfmaemid: string;
  prfmaid: string;
  prfmaclnteid: string;
  prfmampid: string;
  prfmasubtotal: number;
  prfmadescuento: number;
  prfmatotal: number;
  items: ReplaceCompleteProformaItemDao[];
};

type ReplaceCompleteProformaResult = 'updated' | 'not_found' | 'invalid_status' | 'invalid_detail';

type FindProformaByIdDao = {
  prfmaemid: string;
  prfmaid: string;
};

type FindProformasParamsDao = {
  page: number;
  pageSize: number;
};

type ProformaRowDao = {
  prfmaid: string;
  prfmaemid: string;
  prfmasuid: string;
  prfmacjid: string;
  prfmausid: string;
  prfmaclnteid: string;
  prfmampid: string;
  prfmaidentificador: string;
  prfmadocumento?: string | null;
  prfmasubtotal: number | string;
  prfmadescuento: number | string;
  prfmatotal: number | string;
  prfmafchregistro: Date;
  prfmafchactualizacion: Date;
  prfmaestado: ProformaStatus;
  emruc?: string | null;
  emcodigo?: string | null;
  emcorreo?: string | null;
  emlogo?: string | null;
  emrznsocial?: string | null;
  suidentificador?: string | null;
  sunombre?: string | null;
  cjidentificador?: string | null;
  usnombre?: string | null;
  usrol?: string | null;
  clntetipoidentificacion?: string | null;
  clnteidentificacion?: string | null;
  clntenombre?: string | null;
  clntecorreo?: string | null;
  clntedireccion?: string | null;
  clntetelefono?: string | null;
  mpnombre?: string | null;
};

type ProformaItemRowDao = {
  dprfmaid: string;
  dprfmaprfmaid: string;
  dprfmaesinventariable: boolean;
  dprfmacodigo: string | null;
  dprfmadescripcion: string;
  dprfmacantidad: number | string;
  dprfmapreciounitario: number | string;
  dprfmapreciototal: number | string;
};

type ProformaListItemRowDao = {
  prfmaid: string;
  prfmaidentificador: string;
  prfmaestado: ProformaStatus;
  prfmafchregistro: Date;
  prfmaclnteid: string;
  clntenombre: string | null;
  clnteidentificacion: string | null;
  prfmampid: string;
  mpnombre: string | null;
  prfmatotal: number | string;
};

type FindProformasResponseDao = {
  items: ProformaListItemRowDao[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type CreateSendProformaTaskDao = {
  sendemid: string;
  sendprfmaid: string;
  sendprfmaidentificador: string;
  sendprfmadocumento: string;
  sendemruc: string;
  sendemrznsocial: string;
  sendemcorreo: string | null;
  sendclntenombre: string;
  sendclntecorreo: string | null;
  sendclntetelefono: string | null;
  sendprfmatotal: number;
  sendsuidentificador: string;
  sendcjidentificador: string;
  sendmpnombre: string;
};

const SAVE_PROFORMA_HEADER_QUERY = `
  insert into proforma (
    prfmaemid,
    prfmasuid,
    prfmacjid,
    prfmausid,
    prfmaclnteid,
    prfmampid,
    prfmaidentificador,
    prfmasubtotal,
    prfmadescuento,
    prfmatotal
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  returning prfmaid
`;

async function saveProformaHeader(
  proforma: CreateProformaHeaderDao
): Promise<string> {
  try {
    const result = await sql.unsafe<{ prfmaid: string }[]>(SAVE_PROFORMA_HEADER_QUERY, [
      proforma.prfmaemid,
      proforma.prfmasuid,
      proforma.prfmacjid,
      proforma.prfmausid,
      proforma.prfmaclnteid,
      proforma.prfmampid,
      proforma.prfmaidentificador,
      proforma.prfmasubtotal,
      proforma.prfmadescuento,
      proforma.prfmatotal,
    ]);

    const proformaDB = result[0];
    if (!proformaDB) {
      throw new Error('Proforma was not created');
    }

    return proformaDB.prfmaid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proforma.prfmaemid,
        branchId: proforma.prfmasuid,
      },
      'Error saving proforma header',
    );
    throw new Error('Error saving proforma header');
  }
}

const SAVE_PROFORMA_ITEM_QUERY = `
  insert into detalleprfma (
    dprfmaprfmaid,
    dprfmaesinventariable,
    dprfmacodigo,
    dprfmadescripcion,
    dprfmacantidad,
    dprfmapreciounitario,
    dprfmapreciototal
  )
  values ($1, $2, $3, $4, $5, $6, $7)
  returning dprfmaid
`;

async function saveProformaItem(
  item: CreateProformaItemDao
): Promise<string> {
  try {
    const result = await sql.unsafe<{ dprfmaid: string }[]>(SAVE_PROFORMA_ITEM_QUERY, [
      item.dprfmaprfmaid,
      item.dprfmaesinventariable,
      item.dprfmacodigo,
      item.dprfmadescripcion,
      item.dprfmacantidad,
      item.dprfmapreciounitario,
      item.dprfmapreciototal,
    ]);

    const itemDB = result[0];
    if (!itemDB) {
      throw new Error('Proforma item was not created');
    }

    return itemDB.dprfmaid;
  } catch (error) {
    logger.error(
      {
        err: error,
        proformaId: item.dprfmaprfmaid,
        isInventariable: item.dprfmaesinventariable,
      },
      'Error saving proforma item',
    );
    throw new Error('Error saving proforma item');
  }
}

const FIND_PROFORMA_BY_ID_QUERY = `
  select
    p.prfmaid,
    p.prfmaemid,
    p.prfmasuid,
    p.prfmacjid,
    p.prfmausid,
    p.prfmampid,
    p.prfmaclnteid,
    p.prfmaidentificador,
    p.prfmadocumento,
    p.prfmasubtotal,
    p.prfmadescuento,
    p.prfmatotal,
    p.prfmafchregistro,
    p.prfmafchactualizacion,
    p.prfmaestado,
    e.emruc,
    e.emcodigo,
    e.emcorreo,
    e.emlogo,
    e.emrznsocial,
    s.suidentificador,
    s.sunombre,
    c.cjidentificador,
    u.usnombre,
    u.usrol,
    cl.clntetipoidentificacion,
    cl.clnteidentificacion,
    cl.clntenombre,
    cl.clntecorreo,
    cl.clntedireccion,
    cl.clntetelefono,
    mp.mpnombre
  from proforma p
  left join empresa e
    on e.emid = p.prfmaemid
  left join sucursal s
    on s.suid = p.prfmasuid
    and s.suemid = p.prfmaemid
  left join caja c
    on c.cjid = p.prfmacjid
    and c.cjemid = p.prfmaemid
  left join usuario u
    on u.usid = p.prfmausid
    and u.usemid = p.prfmaemid
  left join cliente cl
    on cl.clnteid = p.prfmaclnteid
    and cl.clnteemid = p.prfmaemid
  left join metodopago mp
    on mp.mpid = p.prfmampid
    and mp.mpemid = p.prfmaemid
  where p.prfmaemid = $1 and p.prfmaid = $2
`;

async function findProformaById(
  proforma: FindProformaByIdDao
): Promise<ProformaRowDao | null> {
  try {
    const result = await sql.unsafe<ProformaRowDao[]>(FIND_PROFORMA_BY_ID_QUERY, [
      proforma.prfmaemid,
      proforma.prfmaid,
    ]);

    const proformaDB = result[0];
    if (!proformaDB) {
      return null;
    }

    return proformaDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proforma.prfmaemid,
        proformaId: proforma.prfmaid,
      },
      'Error finding proforma by id',
    );
    throw new Error('Error finding proforma by id');
  }
}

const FIND_PROFORMAS_QUERY = `
  select
    p.prfmaid,
    p.prfmaidentificador,
    p.prfmaestado,
    p.prfmafchregistro,
    p.prfmaclnteid,
    cl.clntenombre,
    cl.clnteidentificacion,
    p.prfmampid,
    mp.mpnombre,
    p.prfmatotal
  from proforma p
  left join cliente cl
    on cl.clnteid = p.prfmaclnteid
    and cl.clnteemid = p.prfmaemid
  left join metodopago mp
    on mp.mpid = p.prfmampid
    and mp.mpemid = p.prfmaemid
  where p.prfmaemid = $1
  order by p.prfmafchregistro desc
  limit $2
  offset $3
`;

const COUNT_PROFORMAS_QUERY = `
  select count(*)::int as total
  from proforma
  where prfmaemid = $1
`;

async function findProformas(
  params: FindProformasParamsDao,
  companyId: string
): Promise<FindProformasResponseDao> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  try {
    const items = await sql.unsafe<ProformaListItemRowDao[]>(FIND_PROFORMAS_QUERY, [
      companyId,
      pageSize,
      offset,
    ]);

    const totalResult = await sql.unsafe<{ total: number }[]>(COUNT_PROFORMAS_QUERY, [companyId]);
    const totalItems = totalResult[0];

    if (!totalItems) {
      throw new Error('Error counting proformas');
    }

    return {
      items,
      page,
      pageSize,
      totalItems: totalItems.total,
      totalPages: Math.ceil(totalItems.total / pageSize),
    };
  } catch (error) {
    logger.error({ err: error, page, pageSize, companyId }, 'Error finding proformas');
    throw new Error('Error finding proformas');
  }
}

const FIND_PROFORMA_ITEMS_QUERY = `
  select
    d.dprfmaid,
    d.dprfmaprfmaid,
    d.dprfmaesinventariable,
    d.dprfmacodigo,
    d.dprfmadescripcion,
    d.dprfmacantidad,
    d.dprfmapreciounitario,
    d.dprfmapreciototal
  from detalleprfma d
  inner join proforma pr
    on pr.prfmaid = d.dprfmaprfmaid
  where d.dprfmaprfmaid = $1 and pr.prfmaemid = $2
  order by d.dprfmaid asc
`;

async function findProformaItems(
  proforma: FindProformaByIdDao
): Promise<ProformaItemRowDao[]> {
  try {
    const items = await sql.unsafe<ProformaItemRowDao[]>(FIND_PROFORMA_ITEMS_QUERY, [
      proforma.prfmaid,
      proforma.prfmaemid,
    ]);

    return items;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proforma.prfmaemid,
        proformaId: proforma.prfmaid,
      },
      'Error finding proforma items',
    );
    throw new Error('Error finding proforma items');
  }
}

const REPLACE_PROFORMA_HEADER_FOR_UPDATE_QUERY = `
  select prfmaestado
  from proforma
  where prfmaid = $1 and prfmaemid = $2
  for update
`;

const REPLACE_PROFORMA_DETAILS_FOR_UPDATE_QUERY = `
  select dprfmaid
  from detalleprfma
  where dprfmaprfmaid = $1
  for update
`;

const INSERT_REPLACE_PROFORMA_DETAIL_QUERY = `
  insert into detalleprfma (
    dprfmaprfmaid,
    dprfmaesinventariable,
    dprfmacodigo,
    dprfmadescripcion,
    dprfmacantidad,
    dprfmapreciounitario,
    dprfmapreciototal
  )
  values ($1, $2, $3, $4, $5, $6, $7)
`;

const UPDATE_REPLACE_PROFORMA_DETAIL_QUERY = `
  update detalleprfma
  set dprfmaesinventariable = $1,
      dprfmacodigo = $2,
      dprfmadescripcion = $3,
      dprfmacantidad = $4,
      dprfmapreciounitario = $5,
      dprfmapreciototal = $6
  where dprfmaid = $7 and dprfmaprfmaid = $8
`;

const DELETE_REPLACE_PROFORMA_DETAIL_QUERY = `
  delete from detalleprfma
  where dprfmaid = $1 and dprfmaprfmaid = $2
`;

const UPDATE_REPLACE_PROFORMA_HEADER_QUERY = `
  update proforma
  set prfmaclnteid = $1,
      prfmampid = $2,
      prfmasubtotal = $3,
      prfmadescuento = $4,
      prfmatotal = $5,
      prfmafchactualizacion = current_timestamp
  where prfmaid = $6 and prfmaemid = $7
`;

async function replaceCompleteProforma(
  proforma: ReplaceCompleteProformaDao,
): Promise<ReplaceCompleteProformaResult> {
  try {
    return await sql.begin(async (transaction): Promise<ReplaceCompleteProformaResult> => {
      const headerRows = await transaction.unsafe<{ prfmaestado: ProformaStatus }[]>(
        REPLACE_PROFORMA_HEADER_FOR_UPDATE_QUERY,
        [proforma.prfmaid, proforma.prfmaemid],
      );
      const header = headerRows[0];

      if (!header) {
        return 'not_found';
      }

      if (header.prfmaestado !== 'emitida') {
        return 'invalid_status';
      }

      const detailRows = await transaction.unsafe<{ dprfmaid: string }[]>(
        REPLACE_PROFORMA_DETAILS_FOR_UPDATE_QUERY,
        [proforma.prfmaid],
      );
      const existingDetailIds = new Set(detailRows.map((item) => item.dprfmaid));
      const retainedDetailIds = new Set<string>();

      for (const item of proforma.items) {
        if (item.dprfmaid !== undefined) {
          if (!existingDetailIds.has(item.dprfmaid)) {
            return 'invalid_detail';
          }

          retainedDetailIds.add(item.dprfmaid);
        }
      }

      for (const item of proforma.items) {
        if (item.dprfmaid === undefined) {
          await transaction.unsafe(
            INSERT_REPLACE_PROFORMA_DETAIL_QUERY,
            [
              proforma.prfmaid,
              item.dprfmaesinventariable,
              item.dprfmacodigo,
              item.dprfmadescripcion,
              item.dprfmacantidad,
              item.dprfmapreciounitario,
              item.dprfmapreciototal,
            ],
          );
          continue;
        }

        await transaction.unsafe(
          UPDATE_REPLACE_PROFORMA_DETAIL_QUERY,
          [
            item.dprfmaesinventariable,
            item.dprfmacodigo,
            item.dprfmadescripcion,
            item.dprfmacantidad,
            item.dprfmapreciounitario,
            item.dprfmapreciototal,
            item.dprfmaid,
            proforma.prfmaid,
          ],
        );
      }

      for (const detail of detailRows) {
        if (!retainedDetailIds.has(detail.dprfmaid)) {
          await transaction.unsafe(
            DELETE_REPLACE_PROFORMA_DETAIL_QUERY,
            [detail.dprfmaid, proforma.prfmaid],
          );
        }
      }

      await transaction.unsafe(
        UPDATE_REPLACE_PROFORMA_HEADER_QUERY,
        [
          proforma.prfmaclnteid,
          proforma.prfmampid,
          proforma.prfmasubtotal,
          proforma.prfmadescuento,
          proforma.prfmatotal,
          proforma.prfmaid,
          proforma.prfmaemid,
        ],
      );

      return 'updated';
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proforma.prfmaemid,
        proformaId: proforma.prfmaid,
      },
      'Error replacing complete proforma',
    );
    throw new Error('Error replacing complete proforma');
  }
}

const FIND_PROFORMA_HEADER_FOR_UPDATE_QUERY = `
  select
    prfmaid,
    prfmaemid,
    prfmasuid,
    prfmacjid,
    prfmausid,
    prfmaclnteid,
    prfmampid,
    prfmaidentificador,
    prfmadescuento,
    prfmatotal,
    prfmafchregistro,
    prfmafchactualizacion,
    prfmaestado
  from proforma
  where prfmaemid = $1 and prfmaid = $2
`;

async function findProformaHeaderForUpdate(
  proforma: FindProformaByIdDao
): Promise<ProformaRowDao | null> {
  try {
    const result = await sql.unsafe<ProformaRowDao[]>(FIND_PROFORMA_HEADER_FOR_UPDATE_QUERY, [
      proforma.prfmaemid,
      proforma.prfmaid,
    ]);

    const proformaDB = result[0];
    if (!proformaDB) {
      return null;
    }

    return proformaDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proforma.prfmaemid,
        proformaId: proforma.prfmaid,
      },
      'Error finding proforma header for update',
    );
    throw new Error('Error finding proforma header for update');
  }
}

const UPDATE_PROFORMA_STATUS_BY_ID_QUERY = `
  update proforma
  set prfmaestado = $1,
      prfmafchactualizacion = current_timestamp
  where prfmaid = $2 and prfmaemid = $3
  returning prfmaid
`;

async function updateProformaStatusById(
  proforma: FindProformaByIdDao,
  status: ProformaStatus
): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ prfmaid: string }[]>(
      UPDATE_PROFORMA_STATUS_BY_ID_QUERY,
      [status, proforma.prfmaid, proforma.prfmaemid],
    );

    const updated = result[0];
    if (!updated) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proforma.prfmaemid,
        proformaId: proforma.prfmaid,
        status,
      },
      'Error updating proforma status by id',
    );
    throw new Error('Error updating proforma status by id');
  }
}

const UPDATE_PROFORMA_DOCUMENT_PATH_BY_ID_QUERY = `
  update proforma
  set prfmadocumento = $1,
      prfmafchactualizacion = current_timestamp
  where prfmaid = $2 and prfmaemid = $3
  returning prfmaid
`;

const SAVE_SEND_PROFORMA_TASK_QUERY = `
  insert into sendproforma (
    sendemid,
    sendprfmaid,
    sendprfmaidentificador,
    sendprfmadocumento,
    sendemruc,
    sendemrznsocial,
    sendemcorreo,
    sendclntenombre,
    sendclntecorreo,
    sendclntetelefono,
    sendprfmatotal,
    sendsuidentificador,
    sendcjidentificador,
    sendmpnombre
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  returning sendid
`;

async function saveSendProformaTask(task: CreateSendProformaTaskDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ sendid: string }[]>(
      SAVE_SEND_PROFORMA_TASK_QUERY,
      [
        task.sendemid,
        task.sendprfmaid,
        task.sendprfmaidentificador,
        task.sendprfmadocumento,
        task.sendemruc,
        task.sendemrznsocial,
        task.sendemcorreo,
        task.sendclntenombre,
        task.sendclntecorreo,
        task.sendclntetelefono,
        task.sendprfmatotal,
        task.sendsuidentificador,
        task.sendcjidentificador,
        task.sendmpnombre,
      ],
    );

    const createdTask = result[0];
    if (!createdTask) {
      throw new Error('Send proforma task was not created');
    }

    return createdTask.sendid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: task.sendemid,
        proformaId: task.sendprfmaid,
      },
      'Error saving send proforma task',
    );
    throw new Error('Error saving send proforma task');
  }
}

async function updateProformaDocumentPathById(
  proforma: FindProformaByIdDao,
  documentPath: string,
): Promise<boolean> {
  try {
    const result = await sql.unsafe<{ prfmaid: string }[]>(
      UPDATE_PROFORMA_DOCUMENT_PATH_BY_ID_QUERY,
      [documentPath, proforma.prfmaid, proforma.prfmaemid],
    );

    const updated = result[0];
    if (!updated) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: proforma.prfmaemid,
        proformaId: proforma.prfmaid,
        documentPath,
      },
      'Error updating proforma document path by id',
    );
    throw new Error('Error updating proforma document path by id');
  }
}

export {
  saveProformaHeader,
  saveProformaItem,
  findProformaById,
  findProformas,
  findProformaItems,
  replaceCompleteProforma,
  findProformaHeaderForUpdate,
  updateProformaStatusById,
  updateProformaDocumentPathById,
  saveSendProformaTask,
};

export type {
  CreateProformaHeaderDao,
  CreateProformaItemDao,
  ReplaceCompleteProformaDao,
  ReplaceCompleteProformaItemDao,
  ReplaceCompleteProformaResult,
  FindProformaByIdDao,
  FindProformasParamsDao,
  ProformaRowDao,
  ProformaItemRowDao,
  ProformaListItemRowDao,
  FindProformasResponseDao,
  CreateSendProformaTaskDao,
};
