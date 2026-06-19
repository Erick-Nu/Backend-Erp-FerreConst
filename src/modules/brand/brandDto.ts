import type { Status } from '../../config/databaseTypes.js';

type CreateBrandDto = {
  mrcemid: string;
  mrcnombre: string;
};

type FindBrandDto = {
  mrcid: string;
};

type UpdateBrandDto = {
  mrcid: string;
  mrcnombre?: string;
  mrcestado?: Status;
};

type FindBrandsParamsDto = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type BrandResponseDto = {
  mrcid: string;
  mrcemid: string;
  mrcnombre: string;
  mrcfchregistro: Date;
  mrcestado: Status;
};

type FindBrandsResponseDto = {
  items: BrandResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateBrandDto,
  FindBrandDto,
  UpdateBrandDto,
  FindBrandsParamsDto,
  BrandResponseDto,
  FindBrandsResponseDto,
};
