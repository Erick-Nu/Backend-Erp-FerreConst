import type { Role, Status } from '../../config/databaseTypes.js';

type UserModel = {
  usid: string;
  usemid: string;
  usnombre: string;
  usapodo: string;
  uscorreo: string;
  uspassword: string;
  usimagen: string;
  usrol: Role;
  usfchregistro: Date;
  usestado: Status;
};

export type { UserModel };
