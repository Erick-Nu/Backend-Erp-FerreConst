type FindAlertsParamsDto = {
  suid?: string;
  tipo?: string;
  visible?: boolean;
  visto?: boolean;
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
  alfchactualizacion: Date;
  alfchnotificacion: Date;
};

type FindAlertsResponseDto = {
  items: AlertResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type AlertSummaryTypeDto = {
  type: string;
  totalVisible: number;
  totalUnseen: number;
};

type AlertSummaryBranchDto = {
  suid: string;
  sunombre: string | null;
  suidentificador: string | null;
  totalVisible: number;
  totalUnseen: number;
};

type AlertSummaryResponseDto = {
  totalVisible: number;
  totalUnseen: number;
  byType: AlertSummaryTypeDto[];
  byBranch: AlertSummaryBranchDto[];
};

export type {
  AlertResponseDto,
  AlertSummaryBranchDto,
  AlertSummaryResponseDto,
  AlertSummaryTypeDto,
  FindAlertsParamsDto,
  FindAlertsResponseDto,
};
