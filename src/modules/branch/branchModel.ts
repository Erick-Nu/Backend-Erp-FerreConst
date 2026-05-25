import type { Status } from '../../config/databaseTypes.js';

type BranchModel = {
  suid: string;
  suemid: string;
  sunombre: string;
  sudireccion: string | null;
  sucorreo: string | null;
  suidentificador: string;
  sufchregistro: Date;
  suestado: Status;
};

export type { BranchModel };
