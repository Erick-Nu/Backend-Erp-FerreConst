import type { Status } from '../../config/databaseTypes.js';

type CreateCheckoutDto = {
  cjemid: string;
  cjsuid: string;
  cjidentificador: string;
};

type FindCheckoutDto = {
  cjid: string;
  cjsuid: string;
};

type UpdateCheckoutDto = {
  cjid: string;
  cjestado: Status;
};

type FindCheckoutsParamsDto = {
  page: number;
  pageSize: number;
};

type CheckoutResponseDto = {
  cjid: string;
  cjemid: string;
  cjsuid: string;
  cjidentificador: string;
  cjfchregistro: Date;
  cjestado: Status;
};

type CheckoutBranchSummaryDto = {
  suid: string;
  sunombre: string;
  suidentificador: string;
  suestado: Status;
};

type CheckoutListItemResponseDto = CheckoutResponseDto & {
  sucursal: CheckoutBranchSummaryDto;
};

type CheckoutDetailResponseDto = CheckoutListItemResponseDto;

type FindCheckoutsResponseDto = {
  items: CheckoutListItemResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateCheckoutDto,
  FindCheckoutDto,
  UpdateCheckoutDto,
  FindCheckoutsParamsDto,
  CheckoutResponseDto,
  CheckoutBranchSummaryDto,
  CheckoutListItemResponseDto,
  CheckoutDetailResponseDto,
  FindCheckoutsResponseDto,
};
