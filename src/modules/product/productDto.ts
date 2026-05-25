import type { Status } from '../../config/databaseTypes.js';

type CreateProductDto = {
  prdtoemid: string;
  prdtoctgriaid: string;
  prdtomrcid: string;
  prdtoprovid: string;
  prdtomdiaid: string;
  prdtocodigo: string;
  prdtonombre: string;
  prdtopreciocompra: number;
  prdtoprecioventa: number;
  prdtostockminimo: number;
  prdtostockmaximo: number;
  prdtoimagen?: string | null;
};

type FindProductDto = {
  prdtoid: string;
};

type UpdateProductDto = {
  prdtoid: string;
  prdtoctgriaid?: string;
  prdtomrcid?: string;
  prdtoprovid?: string;
  prdtomdiaid?: string;
  prdtocodigo?: string;
  prdtonombre?: string;
  prdtopreciocompra?: number;
  prdtoprecioventa?: number;
  prdtostockminimo?: number;
  prdtostockmaximo?: number;
  prdtoimagen?: string | null;
  prdtoestado?: Status;
};

type FindProductsParamsDto = {
  page: number;
  pageSize: number;
};

type ProductCategoryResponseDto = {
  ctgriaid: string;
  ctgnombre: string | null;
  ctgriadescripcion: string | null;
};

type ProductBrandResponseDto = {
  mrcid: string;
  mrcnombre: string | null;
};

type ProductProveedorResponseDto = {
  provid: string;
  provnombre: string | null;
};

type ProductMedidaResponseDto = {
  mdiaid: string;
  mdianombre: string | null;
  mdiaabreviatura: string | null;
};

type ProductResponseDto = {
  prdtoid: string;
  prdtoemid: string;
  categoria: ProductCategoryResponseDto;
  marca: ProductBrandResponseDto;
  proveedor: ProductProveedorResponseDto;
  medida: ProductMedidaResponseDto;
  prdtocodigo: string;
  prdtonombre: string;
  prdtopreciocompra: number;
  prdtoprecioventa: number;
  prdtostockminimo: number;
  prdtostockmaximo: number;
  prdtoimagen: string | null;
  prdtofchregistro: Date;
  prdtoestado: Status;
};

type FindProductsResponseDto = {
  items: ProductResponseDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type {
  CreateProductDto,
  FindProductDto,
  FindProductsParamsDto,
  FindProductsResponseDto,
  ProductResponseDto,
  UpdateProductDto,
};
