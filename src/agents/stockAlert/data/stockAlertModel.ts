type LowStockProductResult = {
  stckemid: string;
  stcksuid: string;
  stckprdtoid: string;
  stckcantidad: number | string;
  prdtostockminimo: number | string;
  prdtostockmaximo: number | string;
  prdtonombre: string;
  prdtocodigo: string;
  sucursalnombre: string;
};

type UpsertAlertData = {
  alemid: string;
  alsuid: string;
  alprdtoid: string;
  altipo: string;
  almensaje: string;
  alcantidadactual: number;
  alstockminimo: number;
  alstockmaximo: number;
};

type ExistingStockAlertResult = {
  alid: string;
  almensaje: string;
  alcantidadactual: number | string;
  alstockminimo: number | string;
  alstockmaximo: number | string;
  alvisible: boolean;
};

type NormalizedLowStockProductResult = Omit<
  LowStockProductResult,
  'stckcantidad' | 'prdtostockminimo' | 'prdtostockmaximo'
> & {
  stckcantidad: number;
  prdtostockminimo: number;
  prdtostockmaximo: number;
};

type NormalizedExistingStockAlertResult = Omit<
  ExistingStockAlertResult,
  'alcantidadactual' | 'alstockminimo' | 'alstockmaximo'
> & {
  alcantidadactual: number;
  alstockminimo: number;
  alstockmaximo: number;
};

type UpsertAlertStatus = 'created' | 'updated' | 'reactivated' | 'reminded' | 'unchanged';

type UpsertAlertResult = {
  alid: string;
  status: UpsertAlertStatus;
};

type ResolvedAlertResult = {
  alid: string;
  alemid: string;
  alsuid: string;
  alprdtoid: string;
  altipo: string;
};

type CompanyRucResult = {
  emid: string;
};

export type {
  CompanyRucResult,
  ExistingStockAlertResult,
  LowStockProductResult,
  NormalizedExistingStockAlertResult,
  NormalizedLowStockProductResult,
  ResolvedAlertResult,
  UpsertAlertData,
  UpsertAlertResult,
  UpsertAlertStatus,
};
