type CreateConfigDto = {
  cfemid: string;
  cfclave: string;
  cfvalor: string;
};

type FindConfigByKeyDto = {
  cfclave: string;
};

type UpdateConfigDto = {
  cfclave: string;
  cfvalor: string;
};

type ConfigResponseDto = {
  cfid: string;
  cfemid: string;
  cfclave: string;
  cfvalor: string;
};

type FindConfigsResponseDto = ConfigResponseDto[];

export type {
  CreateConfigDto,
  FindConfigByKeyDto,
  UpdateConfigDto,
  ConfigResponseDto,
  FindConfigsResponseDto,
};
