import type { Status } from '../../config/databaseTypes.js';

type CreateStockDto = {
  stckemid: string;
  stcksuid: string;
  stckprdtoid: string;
  stckcantidad: number;
};

type FindStockDto = {
  stckid: string;
};

type FindStockByProductDto = {
  stcksuid: string;
  stckprdtoid: string;
};

type UpdateStockDto = {
  stckid: string;
  stcksuid: string;
  stckcantidad?: number;
  stckestado?: Status;
};

type FindStocksParamsDto = {
  stcksuid: string;
  page: number;
  pageSize: number;
};

type FindStocksByCompanyParamsDto = {
  page: number;
  pageSize: number;
};

type StockSucursalResponseDto = {
  suid: string;
  sunombre: string | null;
  suidentificador: string | null;
};

type StockProductoResponseDto = {
  prdtoid: string;
  prdtocodigo: string | null;
  prdtonombre: string | null;
};

type StockResponseDto = {
  stckid: string;
  stckemid: string;
  sucursal: StockSucursalResponseDto;
  producto: StockProductoResponseDto;
  stckcantidad: number;
  stckfchregistro: Date;
  stckfchactualizacion: Date;
  stckestado: Status;
};

type FindStocksResponseDto = {
  items: StockResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateStockDto,
  FindStockDto,
  FindStockByProductDto,
  UpdateStockDto,
  FindStocksParamsDto,
  FindStocksByCompanyParamsDto,
  StockResponseDto,
  FindStocksResponseDto,
};
