import type { Identification, Status } from '../../config/databaseTypes.js';

type ClientModel = {
  clnteid: string;
  clnteemid: string;
  clntetipoidentificacion: Identification;
  clnteidentificacion: string;
  clntenombre: string;
  clntecorreo: string;
  clntedireccion: string;
  clntetelefono: string;
  clntefchregistro: Date;
  clnteestado: Status;
};

export type { ClientModel };
