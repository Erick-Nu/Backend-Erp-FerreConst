import {Status} from '../../config/databaseTypes.js';


type CreateCompanyDto = {
  emruc: string;
  emrznsocial: string;
  emcorreo: string;
  emlogo: string;
  emcodigo: string;
};

type FindCompanyDto = {
  emid: string;
}

type UpdateStatusCompanyDto = {
  emid: string;
  emestado: Status;
}

type UpdateCompanyDto = {
  emid: string;
  emrznsocial?: string;
  emcorreo?: string;
  emlogo?: string;
}

type CompanyResponseDto = {
  emid: string;
  emruc: string;
  emrznsocial: string;
  emcorreo: string;
  emlogo: string;
  emcodigo: string;
  emfchregistro: Date;
  emestado: Status;
}

type FindCompaniesParamsDto = {
  page: number;
  pageSize: number;
  search?: string;
  status?: Status;
};

type FindCompaniesResponseDto = {
  items: CompanyResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateCompanyDto,
  FindCompanyDto,
  UpdateCompanyDto,
  CompanyResponseDto,
  FindCompaniesParamsDto,
  FindCompaniesResponseDto,
  UpdateStatusCompanyDto
};
