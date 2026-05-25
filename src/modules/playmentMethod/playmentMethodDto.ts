import type { Status } from '../../config/databaseTypes.js';

type CreatePlaymentMethodDto = {
  mpemid: string;
  mpnombre: string;
};

type FindPlaymentMethodDto = {
  mpid: string;
};

type UpdatePlaymentMethodDto = {
  mpid: string;
  mpnombre?: string;
  mpestado?: Status;
};

type FindPlaymentMethodsParamsDto = {
  page: number;
  pageSize: number;
};

type PlaymentMethodResponseDto = {
  mpid: string;
  mpemid: string;
  mpnombre: string;
  mpfchregistro: Date;
  mpestado: Status;
};

type FindPlaymentMethodsResponseDto = {
  items: PlaymentMethodResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreatePlaymentMethodDto,
  FindPlaymentMethodDto,
  UpdatePlaymentMethodDto,
  FindPlaymentMethodsParamsDto,
  PlaymentMethodResponseDto,
  FindPlaymentMethodsResponseDto,
};
