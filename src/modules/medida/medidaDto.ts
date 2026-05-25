import type { Status } from '../../config/databaseTypes.js';

type CreateMedidaDto = {
  mdiaemid: string;
  mdianombre: string;
  mdiaabreviatura: string;
};

type FindMedidaDto = {
  mdiaid: string;
};

type UpdateMedidaDto = {
  mdiaid: string;
  mdianombre?: string;
  mdiaabreviatura?: string;
  mdiaestado?: Status;
};

type FindMedidasParamsDto = {
  page: number;
  pageSize: number;
};

type MedidaResponseDto = {
  mdiaid: string;
  mdiaemid: string;
  mdianombre: string;
  mdiaabreviatura: string;
  mdiafchregistro: Date;
  mdiaestado: Status;
};

type FindMedidasResponseDto = {
  items: MedidaResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateMedidaDto,
  FindMedidaDto,
  UpdateMedidaDto,
  FindMedidasParamsDto,
  MedidaResponseDto,
  FindMedidasResponseDto,
};
