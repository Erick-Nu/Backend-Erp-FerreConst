import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateProveedorDto,
  FindProveedorDto,
  FindProveedoresParamsDto,
  UpdateProveedorDto,
} from './proveedorDto.js';
import {
  createProveedor,
  readProveedor,
  readProveedores,
  updateProveedor,
} from './proveedorService.js';

type UpdateProveedorRequestBody = Omit<UpdateProveedorDto, 'provid'>;

const registerProveedor: RequestHandler = async (req, res, next) => {
  try {
    const { provemid, provctgriaid, provmrcid, provnombre, provtelefono, provcorreo } = req.body;
    const proveedor: CreateProveedorDto = {
      provemid,
      provctgriaid: provctgriaid ?? null,
      provmrcid: provmrcid ?? null,
      provnombre,
      provtelefono: provtelefono,
      provcorreo: provcorreo ?? null,
    };
    const user: LoginUserDto = req.auth!;

    const proveedorDB = await createProveedor(proveedor, user);

    res.status(201).json(proveedorDB);
  } catch (error) {
    next(error);
  }
};

const searchProveedores: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindProveedoresParamsDto = {
      page,
      pageSize,
    };
    const user: LoginUserDto = req.auth!;
    const proveedoresDB = await readProveedores(params, user);

    res.status(200).json(proveedoresDB);
  } catch (error) {
    next(error);
  }
};

const searchProveedor: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Proveedor id is required' });
      return;
    }

    const proveedor: FindProveedorDto = {
      provid: id,
    };
    const user: LoginUserDto = req.auth!;

    const proveedorDB = await readProveedor(proveedor, user);
    if (!proveedorDB) {
      res.status(404).json({ message: 'Proveedor not found' });
      return;
    }

    res.status(200).json(proveedorDB);
  } catch (error) {
    next(error);
  }
};

const updateProveedorData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Proveedor id is required' });
      return;
    }

    const body: UpdateProveedorRequestBody = req.body;
    const { provctgriaid, provmrcid, provnombre, provtelefono, provcorreo, provestado } = body;
    const proveedor: UpdateProveedorDto = {
      provid: id,
    };

    if (provctgriaid !== undefined) {
      proveedor.provctgriaid = provctgriaid;
    }

    if (provmrcid !== undefined) {
      proveedor.provmrcid = provmrcid;
    }

    if (provnombre !== undefined) {
      proveedor.provnombre = provnombre;
    }

    if (provtelefono !== undefined) {
      proveedor.provtelefono = provtelefono;
    }

    if (provcorreo !== undefined) {
      proveedor.provcorreo = provcorreo;
    }

    if (provestado !== undefined) {
      proveedor.provestado = provestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedProveedor = await updateProveedor(proveedor, user);
    if (!updatedProveedor) {
      res.status(404).json({ message: 'Proveedor not found' });
      return;
    }

    res.status(200).json(updatedProveedor);
  } catch (error) {
    next(error);
  }
};

export { registerProveedor, searchProveedores, searchProveedor, updateProveedorData };
