type FindAlertsParamsDto = {
  suid?: string;
  page: number;
  pageSize: number;
};

type AlertResponseDto = {
  alid: string;
  alemid: string;
  branch: {
    suid: string;
    sunombre: string | null;
    suidentificador: string | null;
  };
  product: {
    prdtoid: string;
    prdtocodigo: string | null;
    prdtonombre: string | null;
  };
  altipo: string;
  almensaje: string;
  alcantidadactual: number;
  alstockminimo: number;
  alstockmaximo: number;
  alvisible: boolean;
  alvisto: boolean;
  alfchcreacion: Date;
};

type FindAlertsResponseDto = {
  items: AlertResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type { AlertResponseDto, FindAlertsParamsDto, FindAlertsResponseDto };
