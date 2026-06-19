import type { Identification, Status } from '../../config/databaseTypes.js';

type CreateClientDto = {
  clnteemid: string;
  clntetipoidentificacion: Identification;
  clnteidentificacion: string;
  clntenombre: string;
  clntecorreo: string;
  clntedireccion: string;
  clntetelefono: string;
};

type FindClientDto = {
  clnteid: string;
};

type UpdateClientDto = {
  clnteid: string;
  clntetipoidentificacion?: Identification;
  clnteidentificacion?: string;
  clntenombre?: string;
  clntecorreo?: string;
  clntedireccion?: string;
  clntetelefono?: string;
  clnteestado?: Status;
};

type FindClientsParamsDto = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type ClientResponseDto = {
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

type FindClientsResponseDto = {
  items: ClientResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateClientDto,
  FindClientDto,
  UpdateClientDto,
  FindClientsParamsDto,
  ClientResponseDto,
  FindClientsResponseDto,
};
