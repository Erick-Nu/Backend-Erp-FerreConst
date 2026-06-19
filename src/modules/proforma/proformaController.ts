import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateProformaDto,
  FindProformaDto,
  FindProformasParamsDto,
  ProformaActionDto,
  ReplaceProformaDto,
} from './proformaDto.js';
import {
  cancelProforma,
  createProforma,
  payProforma,
  readProforma,
  readProformaPdfDocument,
  readProformas,
  replaceProforma,
  sendProforma,
} from './proformaService.js';
import { isValidProformaStatus } from '../../utils/validation.js';

type ReplaceProformaRequestBody = Omit<ReplaceProformaDto, 'prfmaid'>;

const registerProforma: RequestHandler = async (req, res, next) => {
  try {
    const {
      prfmasuid,
      prfmacjid,
      prfmaclnteid,
      prfmampid,
      prfmasubtotal,
      prfmadescuento,
      prfmatotal,
      dprfmaproductos,
    } = req.body;

    const proforma: CreateProformaDto = {
      prfmasuid,
      prfmacjid,
      prfmaclnteid,
      prfmampid,
      prfmasubtotal,
      prfmatotal,
      dprfmaproductos,
    };

    if (prfmadescuento !== undefined) {
      proforma.prfmadescuento = prfmadescuento;
    }

    const user: LoginUserDto = req.auth!;
    const proformaDB = await createProforma(proforma, user);

    res.status(201).json(proformaDB);
  } catch (error) {
    next(error);
  }
};

const searchProformas: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'Search must be a string' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'Status must be a string' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidProformaStatus(statusQuery)) {
      res.status(400).json({ message: 'Status must be emitida, pagada or anulada' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindProformasParamsDto = {
      page,
      pageSize,
    };
    const user: LoginUserDto = req.auth!;

    const proformasDB = await readProformas(params, user);

    res.status(200).json(proformasDB);
  } catch (error) {
    next(error);
  }
};

const searchProforma: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Proforma id is required' });
      return;
    }

    const proforma: FindProformaDto = {
      prfmaid: id,
    };

    const user: LoginUserDto = req.auth!;
    const proformaDB = await readProforma(proforma, user);

    if (!proformaDB) {
      res.status(404).json({ message: 'Proforma not found' });
      return;
    }

    res.status(200).json(proformaDB);
  } catch (error) {
    next(error);
  }
};

const searchProformaPdf: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Proforma id is required' });
      return;
    }

    const proforma: FindProformaDto = {
      prfmaid: id,
    };

    const user: LoginUserDto = req.auth!;
    const proformaPdfDB = await readProformaPdfDocument(proforma, user);

    if (!proformaPdfDB) {
      res.status(404).json({ message: 'Proforma not found' });
      return;
    }

    if (!proformaPdfDB.proforma.documento.docurl) {
      res.status(404).json({ message: 'Proforma pdf document not found' });
      return;
    }

    res.status(200).json(proformaPdfDB);
  } catch (error) {
    next(error);
  }
};

const replaceProformaData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Proforma id is required' });
      return;
    }

    const body: ReplaceProformaRequestBody = req.body;
    const {
      prfmaclnteid,
      prfmampid,
      prfmasubtotal,
      prfmadescuento,
      prfmatotal,
      dprfmaproductos,
    } = body;

    const proforma: ReplaceProformaDto = {
      prfmaid: id,
      prfmaclnteid,
      prfmampid,
      prfmasubtotal,
      prfmadescuento,
      prfmatotal,
      dprfmaproductos,
    };

    const user: LoginUserDto = req.auth!;
    const updatedProforma = await replaceProforma(proforma, user);

    if (!updatedProforma) {
      res.status(404).json({ message: 'Proforma not found' });
      return;
    }

    res.status(200).json(updatedProforma);
  } catch (error) {
    next(error);
  }
};

const payProformaData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Proforma id is required' });
      return;
    }

    const proforma: ProformaActionDto = {
      prfmaid: id,
    };

    const user: LoginUserDto = req.auth!;
    const updatedProforma = await payProforma(proforma, user);

    if (!updatedProforma) {
      res.status(404).json({ message: 'Proforma not found' });
      return;
    }

    res.status(200).json(updatedProforma);
  } catch (error) {
    next(error);
  }
};

const cancelProformaData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Proforma id is required' });
      return;
    }

    const proforma: ProformaActionDto = {
      prfmaid: id,
    };

    const user: LoginUserDto = req.auth!;
    const updatedProforma = await cancelProforma(proforma, user);

    if (!updatedProforma) {
      res.status(404).json({ message: 'Proforma not found' });
      return;
    }

    res.status(200).json(updatedProforma);
  } catch (error) {
    next(error);
  }
};

export {
  registerProforma,
  searchProformas,
  searchProforma,
  searchProformaPdf,
  replaceProformaData,
  payProformaData,
  cancelProformaData,
};
