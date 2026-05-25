import type { Status } from '../../config/databaseTypes.js';

type StockModel = {
  stckid: string;
  stckemid: string;
  stcksuid: string;
  stckprdtoid: string;
  stckcantidad: number;
  stckfchregistro: Date;
  stckfchactualizacion: Date;
  stckestado: Status;
};

export type { StockModel };
