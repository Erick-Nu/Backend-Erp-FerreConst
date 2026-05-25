import type { Status } from '../../config/databaseTypes.js';

type CompanyModel = {
  emid: string;
  emruc: string;
  emrznsocial: string;
  emcorreo: string;
  emlogo: string;
  emcodigo: string;
  emfchregistro: Date;
  emestado: Status;
  empadre: boolean;
};

export type { CompanyModel };
