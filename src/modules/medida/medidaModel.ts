import type { Status } from '../../config/databaseTypes.js';

type MedidaModel = {
  mdiaid: string;
  mdiaemid: string;
  mdianombre: string;
  mdiaabreviatura: string;
  mdiafchregistro: Date;
  mdiaestado: Status;
};

export type { MedidaModel };
