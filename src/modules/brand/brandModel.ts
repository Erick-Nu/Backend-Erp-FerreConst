import type { Status } from '../../config/databaseTypes.js';

type BrandModel = {
  mrcid: string;
  mrcemid: string;
  mrcnombre: string;
  mrcfchregistro: Date;
  mrcestado: Status;
};

export type { BrandModel };
