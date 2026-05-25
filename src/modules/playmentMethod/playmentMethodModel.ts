import type { Status } from '../../config/databaseTypes.js';

type PlaymentMethodModel = {
  mpid: string;
  mpemid: string;
  mpnombre: string;
  mpfchregistro: Date;
  mpestado: Status;
};

export type { PlaymentMethodModel };
