import type { Role, Status } from '../../config/databaseTypes.js';

type LoginDto = {
  emruc: string;
  usapodo: string;
  uspassword: string;
};

type LoginResponseDto = {
  accessToken: string;
  company: {
    emid: string;
    emruc: string;
    emrznsocial: string;
    emlogo: string;
    emestado: Status;
    empadre: boolean;
  };
  user: {
    usid: string;
    usemid: string;
    usnombre: string;
    usapodo: string;
    uscorreo: string;
    usimagen: string;
    usrol: Role;
    usestado: Status;
  };
};

type LoginUserDto = {
  usid: string;
  usemid: string;
  usrol: Role;
}



export type { LoginDto, LoginResponseDto, LoginUserDto};
