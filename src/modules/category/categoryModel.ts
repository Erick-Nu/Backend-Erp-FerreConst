import type { Status } from '../../config/databaseTypes.js';

type CategoryModel = {
  ctgriaid: string;
  ctgriaemid: string;
  ctgnombre: string;
  ctgriadescripcion: string | null;
  ctgriafchregistro: Date;
  ctgriaestado: Status;
};

export type { CategoryModel };
