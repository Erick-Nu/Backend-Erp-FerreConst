import type { SendStatus } from '../../../config/databaseTypes.js';

type SendProformaModel = {
  sendid: string;
  sendemid: string;
  sendprfmaid: string;
  sendprfmaidentificador: string;
  sendprfmadocumento: string;
  sendemruc: string;
  sendemrznsocial: string;
  sendemcorreo: string | null;
  sendclntenombre: string;
  sendclntecorreo: string | null;
  sendclntetelefono: string | null;
  sendprfmatotal: number;
  sendsuidentificador: string;
  sendcjidentificador: string;
  sendmpnombre: string;
  sendestado: SendStatus;
  sendintentos: number;
  senderror: string | null;
  sendfchcreacion: Date;
  sendfchactualizacion: Date;
};

type CompanyEmailCredentials = {
  emailUser: string;
  emailPassword: string;
};

export type { SendProformaModel, CompanyEmailCredentials };
