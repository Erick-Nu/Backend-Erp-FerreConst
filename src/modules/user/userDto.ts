import type { Role, Status } from '../../config/databaseTypes.js';

type CreateUserDto = {
  usemid: string;
  usnombre: string;
  usapodo: string;
  uscorreo: string;
  uspassword: string;
  usimagen: string;
  usrol: Role;
};

type FindUserDto = {
  usid: string;
}

type UpdateStatusUserDto = {
  usid: string;
  usestado: Status;
}

type UpdateUserDto = {
  usid: string;
  usnombre?: string;
  uscorreo?: string;
  usimagen?: string;
  usestado?: Status;
  usrol?: Role;
}

type FindUsersParamsDto = {
  page: number;
  pageSize: number;
};

type FindUsersResponseDto = {
  items: UserResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};


type UserResponseDto = {
  usid: string;
  usemid: string;
  usnombre: string;
  usapodo: string;
  uscorreo: string;
  usimagen: string;
  usrol: Role;
  usfchregistro: Date;
  usestado: Status;
}


export type {
  CreateUserDto,
  UserResponseDto,
  FindUserDto,
  UpdateUserDto,
  UpdateStatusUserDto,
  FindUsersParamsDto,
  FindUsersResponseDto
};
