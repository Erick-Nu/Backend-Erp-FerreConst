import type { Status } from '../../config/databaseTypes.js';

type CheckoutModel = {
  cjid: string;
  cjemid: string;
  cjsuid: string;
  cjidentificador: string;
  cjfchregistro: Date;
  cjestado: Status;
};

export type { CheckoutModel };
