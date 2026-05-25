import type { Status } from '../../config/databaseTypes.js';

type ProductModel = {
  prdtoid: string;
  prdtoemid: string;
  prdtoctgriaid: string;
  prdtomrcid: string;
  prdtoprovid: string;
  prdtomdiaid: string;
  prdtocodigo: string;
  prdtonombre: string;
  prdtopreciocompra: number;
  prdtoprecioventa: number;
  prdtostockminimo: number;
  prdtostockmaximo: number;
  prdtoimagen: string | null;
  prdtofchregistro: Date;
  prdtoestado: Status;
};

export type { ProductModel };
