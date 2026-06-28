import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateClientDto,
  FindClientDto,
  FindClientsParamsDto,
  UpdateClientDto,
} from './clientDto.js';
import { createClient, readClient, readClients, updateClient } from './clientService.js';
import { isValidFilterStatus } from '../../utils/validation.js';

type UpdateClientRequestBody = Omit<UpdateClientDto, 'clnteid'>;

const registerClient: RequestHandler = async (req, res, next) => {
  try {
    const {
      clnteemid,
      clntetipoidentificacion,
      clnteidentificacion,
      clntenombre,
      clntecorreo,
      clntedireccion,
      clntetelefono,
    } = req.body;

    const client: CreateClientDto = {
      clnteemid,
      clntetipoidentificacion,
      clnteidentificacion,
      clntenombre,
      clntecorreo,
      clntedireccion,
      clntetelefono,
    };
    const user: LoginUserDto = req.auth!;

    const clientDB = await createClient(client, user);

    res.status(201).json(clientDB);
  } catch (error) {
    next(error);
  }
};

const searchClients: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'La búsqueda debe ser un texto' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser un texto' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidFilterStatus(statusQuery)) {
      res.status(400).json({ message: 'El estado debe ser activo o inactivo' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindClientsParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidFilterStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const user: LoginUserDto = req.auth!;
    const clientsDB = await readClients(params, user);

    res.status(200).json(clientsDB);
  } catch (error) {
    next(error);
  }
};

const searchClient: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de cliente es requerido' });
      return;
    }

    const client: FindClientDto = {
      clnteid: id,
    };
    const user: LoginUserDto = req.auth!;

    const clientDB = await readClient(client, user);
    if (!clientDB) {
      res.status(404).json({ message: 'Cliente no encontrado' });
      return;
    }

    res.status(200).json(clientDB);
  } catch (error) {
    next(error);
  }
};

const updateClientData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de cliente es requerido' });
      return;
    }

    const body: UpdateClientRequestBody = req.body;
    const {
      clntetipoidentificacion,
      clnteidentificacion,
      clntenombre,
      clntecorreo,
      clntedireccion,
      clntetelefono,
      clnteestado,
    } = body;

    const client: UpdateClientDto = {
      clnteid: id,
    };

    if (clntetipoidentificacion !== undefined) {
      client.clntetipoidentificacion = clntetipoidentificacion;
    }

    if (clnteidentificacion !== undefined) {
      client.clnteidentificacion = clnteidentificacion;
    }

    if (clntenombre !== undefined) {
      client.clntenombre = clntenombre;
    }

    if (clntecorreo !== undefined) {
      client.clntecorreo = clntecorreo;
    }

    if (clntedireccion !== undefined) {
      client.clntedireccion = clntedireccion;
    }

    if (clntetelefono !== undefined) {
      client.clntetelefono = clntetelefono;
    }

    if (clnteestado !== undefined) {
      client.clnteestado = clnteestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedClient = await updateClient(client, user);
    if (!updatedClient) {
      res.status(404).json({ message: 'Cliente no encontrado' });
      return;
    }

    res.status(200).json(updatedClient);
  } catch (error) {
    next(error);
  }
};

export { registerClient, searchClients, searchClient, updateClientData };
