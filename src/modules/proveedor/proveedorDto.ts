import type { Status } from '../../config/databaseTypes.js';

type CreateProveedorDto = {
  provemid: string;
  provctgriaid: string | null;
  provmrcid: string | null;
  provnombre: string;
  provtelefono: string;
  provcorreo: string | null;
};

type FindProveedorDto = {
  provid: string;
};

type UpdateProveedorDto = {
  provid: string;
  provctgriaid?: string | null;
  provmrcid?: string | null;
  provnombre?: string;
  provtelefono?: string;
  provcorreo?: string | null;
  provestado?: Status;
};

type FindProveedoresParamsDto = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type ProveedorCategoryResponseDto = {
  ctgriaid: string;
  ctgnombre: string | null;
  ctgriadescripcion: string | null;
};

type ProveedorBrandResponseDto = {
  mrcid: string;
  mrcnombre: string | null;
};

type ProveedorResponseDto = {
  provid: string;
  provemid: string;
  categoria: ProveedorCategoryResponseDto | null;
  marca: ProveedorBrandResponseDto | null;
  provnombre: string;
  provtelefono: string;
  provcorreo: string | null;
  provfchregistro: Date;
  provestado: Status;
};

type FindProveedoresResponseDto = {
  items: ProveedorResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateProveedorDto,
  FindProveedorDto,
  UpdateProveedorDto,
  FindProveedoresParamsDto,
  ProveedorResponseDto,
  FindProveedoresResponseDto,
};
