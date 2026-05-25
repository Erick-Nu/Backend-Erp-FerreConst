import type { Status } from '../../config/databaseTypes.js';

type ProveedorModel = {
  provid: string;
  provemid: string;
  provctgriaid: string | null;
  provmrcid: string | null;
  provnombre: string;
  provtelefono: string;
  provcorreo: string | null;
  provfchregistro: Date;
  provestado: Status;
};

export type { ProveedorModel };
