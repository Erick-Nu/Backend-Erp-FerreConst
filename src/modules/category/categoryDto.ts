import type { Status } from '../../config/databaseTypes.js';

type CreateCategoryDto = {
  ctgriaemid: string;
  ctgnombre: string;
  ctgriadescripcion: string | null;
};

type FindCategoryDto = {
  ctgriaid: string;
};

type UpdateCategoryDto = {
  ctgriaid: string;
  ctgnombre?: string;
  ctgriadescripcion?: string | null;
  ctgriaestado?: Status;
};

type FindCategoriesParamsDto = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type CategoryResponseDto = {
  ctgriaid: string;
  ctgriaemid: string;
  ctgnombre: string;
  ctgriadescripcion: string | null;
  ctgriafchregistro: Date;
  ctgriaestado: Status;
};

type FindCategoriesResponseDto = {
  items: CategoryResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateCategoryDto,
  FindCategoryDto,
  UpdateCategoryDto,
  FindCategoriesParamsDto,
  CategoryResponseDto,
  FindCategoriesResponseDto,
};
