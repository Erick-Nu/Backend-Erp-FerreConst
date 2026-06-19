import type { ProformaStatus } from '../../config/databaseTypes.js';

type ProformaPdfCompanyData = {
  ruc: string;
  razonSocial: string;
  correo?: string;
};

type ProformaPdfClientData = {
  nombre: string;
  identificacion?: string;
  correo?: string;
  direccion?: string;
  telefono?: string;
};

type ProformaPdfItemData = {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
};

type ProformaPdfTotalsData = {
  subtotal: number;
  descuento: number;
  total: number;
};

type ProformaPdfBrandingData = {
  fontRegularPath?: string;
  fontBoldPath?: string;
  termsMessage?: string;
};

type ProformaPdfInput = {
  identificador: string;
  fechaEmision: Date;
  estado: ProformaStatus;
  empresa: ProformaPdfCompanyData;
  cliente: ProformaPdfClientData;
  metodoPago: string;
  detalle: ProformaPdfItemData[];
  totales: ProformaPdfTotalsData;
  branding?: ProformaPdfBrandingData;
  outputFileName?: string;
};

type ProformaPdfResult = {
  fileName: string;
  absolutePath: string;
  relativePath: string;
};

type ProformaPdfFontConfig = {
  regular: string;
  bold: string;
};

export type {
  ProformaPdfBrandingData,
  ProformaPdfCompanyData,
  ProformaPdfClientData,
  ProformaPdfFontConfig,
  ProformaPdfInput,
  ProformaPdfItemData,
  ProformaPdfResult,
  ProformaPdfTotalsData,
};
