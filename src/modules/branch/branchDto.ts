import type { Status } from '../../config/databaseTypes.js';

type CreateBranchDto = {
  suemid: string;
  sunombre: string;
  sudireccion: string | null;
  sucorreo: string | null;
  suidentificador: string;
};

type BranchResponseDto = {
  suid: string;
  suemid: string;
  sunombre: string;
  sudireccion: string | null;
  sucorreo: string | null;
  suidentificador: string;
  sufchregistro: Date;
  suestado: Status;
};

type FindBranchDto = {
  suid: string;
};

type UpdateBranchDto = {
  suid: string;
  sunombre?: string;
  sudireccion?: string | null;
  sucorreo?: string | null;
  suidentificador?: string;
  suestado?: Status;
};

type FindBranchesParamsDto = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type FindBranchesResponseDto = {
  items: BranchResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateBranchDto,
  BranchResponseDto,
  FindBranchDto,
  UpdateBranchDto,
  FindBranchesParamsDto,
  FindBranchesResponseDto,
};
