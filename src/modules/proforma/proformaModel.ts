import type { ProformaStatus } from '../../config/databaseTypes.js';

type ProformaModel = {
  prfmaid: string;
  prfmaemid: string;
  prfmasuid: string;
  prfmacjid: string;
  prfmausid: string;
  prfmaclnteid: string;
  prfmampid: string;
  prfmaidentificador: string;
  prfmasubtotal: number;
  prfmadescuento: number;
  prfmatotal: number;
  prfmafchregistro: Date;
  prfmafchactualizacion: Date;
  prfmaestado: ProformaStatus;
};

export type { ProformaModel };
