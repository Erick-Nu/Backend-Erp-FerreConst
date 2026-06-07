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

type CompanyRucResult = {
  emid: string;
};

export type { LowStockProductResult, UpsertAlertData, CompanyRucResult };
