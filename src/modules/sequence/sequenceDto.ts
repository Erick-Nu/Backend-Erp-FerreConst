type CreateSequenceDto = {
  seemid: string;
  sesuid: string;
};

type FindSequenceDto = {
  seemid: string;
  sesuid: string;
};

type SequenceResponseDto = {
  seid: string;
  seemid: string;
  sesuid: string;
  sevalor: number;
  sefchactualizacion: Date;
};

export type {
  CreateSequenceDto,
  FindSequenceDto,
  SequenceResponseDto,
};
