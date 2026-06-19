type LowStockProductResult = {
  stckemid: string;
  stcksuid: string;
  stckprdtoid: string;
  stckcantidad: number;
  prdtostockminimo: number;
  prdtostockmaximo: number;
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
  alcantidadactual: number;
  alstockminimo: number;
  alstockmaximo: number;
  alvisible: boolean;
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
  ResolvedAlertResult,
  UpsertAlertData,
  UpsertAlertResult,
  UpsertAlertStatus,
};
