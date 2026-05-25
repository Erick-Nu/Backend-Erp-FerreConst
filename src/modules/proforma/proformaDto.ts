import type { ProformaStatus } from '../../config/databaseTypes.js';

type CreateProformaItemDto = {
  dprfmaesinventariable: boolean;
  dprfmacodigo?: string;
  dprfmadescripcion: string;
  dprfmacantidad: number;
  dprfmapreciounitario: number;
  dprfmapreciototal: number;
};

type CreateProformaDto = {
  prfmasuid: string;
  prfmacjid: string;
  prfmaclnteid: string;
  prfmampid: string;
  prfmasubtotal: number;
  prfmadescuento?: number;
  prfmatotal: number;
  dprfmaproductos: CreateProformaItemDto[];
};

type FindProformaDto = {
  prfmaid: string;
};

type FindProformasParamsDto = {
  page: number;
  pageSize: number;
};

type ReplaceProformaItemDto = CreateProformaItemDto & {
  dprfmaid?: string;
};

type ReplaceProformaDto = {
  prfmaid: string;
  prfmaclnteid: string;
  prfmampid: string;
  prfmasubtotal: number;
  prfmadescuento: number;
  prfmatotal: number;
  dprfmaproductos: ReplaceProformaItemDto[];
};

type ProformaActionDto = {
  prfmaid: string;
};

type ProformaItemResponseDto = {
  dprfmaid: string;
  dprfmatipoitem: 'inventariable' | 'manual';
  producto: {
    dprfmacodigo: string | null;
    dprfmadescripcion: string | null;
    dprfmacantidad: number;
    dprfmapreciounitario: number;
    dprfmapreciototal: number;
  };
};

type ProformaResponseDto = {
  proforma: {
    prfmaid: string;
    prfmaidentificador: string;
    prfmaestado: ProformaStatus;
    prfmafchregistro: Date;
    prfmafchactualizacion: Date;
    emisor: {
      empresa: {
        emid: string;
        emruc: string | null;
        emcodigo: string | null;
        emcorreo: string | null;
        emlogo: string | null;
        emrznsocial: string | null;
      };
      sucursal: {
        suid: string;
        suidentificador: string | null;
        sunombre: string | null;
      };
      caja: {
        cjid: string;
        cjidentificador: string | null;
      };
      usuario: {
        usid: string;
        usnombre: string | null;
        usrol: string | null;
      };
    };
    receptor: {
      cliente: {
        clnteid: string;
        clntenombre: string | null;
        clnteidentificacion: string | null;
        clntecorreo: string | null;
        clntetelefono: string | null;
        clntedireccion: string | null;
      };
    };
    metodoPago: {
      mpid: string;
      mpnombre: string | null;
    };
    detalle: ProformaItemResponseDto[];
    total: {
      prfmasubtotal: number;
      prfmadescuento: number;
      prfmatotal: number;
    };
  };
};

type FindProformasResponseDto = {
  items: ProformaResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateProformaDto,
  CreateProformaItemDto,
  FindProformaDto,
  FindProformasParamsDto,
  ReplaceProformaDto,
  ReplaceProformaItemDto,
  ProformaActionDto,
  ProformaItemResponseDto,
  ProformaResponseDto,
  FindProformasResponseDto,
};
