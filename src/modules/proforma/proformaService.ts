import type { ProformaStatus } from '../../config/databaseTypes.js';
import { access } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { validateNumber, validateRequiredString } from '../../utils/validation.js';
import { toPublicImageUrl } from '../../middlewares/uploadImage.js';
import {
  buildProformaFileName,
  buildProformaPdfAbsolutePath,
  buildProformaPdfRelativePath,
  generateProformaPdf,
  type ProformaPdfInput,
} from '../../utils/pdf/proformaGenerator.js';
import type { LoginUserDto } from '../auth/authDto.js';
import { findBranchById } from '../branch/branchDao.js';
import { findCheckoutByRowId } from '../checkout/checkoutDao.js';
import { findClientById } from '../client/clientDao.js';
import { findCompanyById } from '../company/companyDao.js';
import { findPlaymentMethodById } from '../playmentMethod/playmentMethodDao.js';
import { findProductByCode } from '../product/productDao.js';
import { incrementSequenceByCompanyAndBranch } from '../sequence/sequenceDao.js';
import { findStockByProductId, updateStockById, type UpdateColumnStockDao } from '../stock/stockDao.js';
import { findUserById } from '../user/userDao.js';
import {
  findProformaById,
  findProformaItems,
  findProformaHeaderForUpdate,
  findProformas,
  replaceCompleteProforma,
  saveSendProformaTask,
  saveProformaHeader,
  saveProformaItem,
  updateProformaDocumentPathById,
  updateProformaStatusById,
  type CreateSendProformaTaskDao,
  type ProformaItemRowDao,
  type ProformaRowDao,
  type ReplaceCompleteProformaItemDao,
} from './proformaDao.js';
import type {
  CreateProformaDto,
  FindProformaDto,
  ProformaPdfResponseDto,
  FindProformasParamsDto,
  FindProformasResponseDto,
  ProformaActionDto,
  ProformaResponseDto,
  ReplaceProformaDto,
} from './proformaDto.js';
import { sendEmail } from '../../services/nodemailer.js';
import { getCompanyTransporter } from '../../agents/sendProforma/email/sendProformaTransporter.js';
import {
  buildSendProformaEmailBody,
  resolveDocumentPath,
  validateDocumentAccess,
} from '../../agents/sendProforma/email/sendProformaTemplate.js';
import { sendProformaByWhatsapp } from '../../agents/sendProforma/whatsapp/sendProformaWhatsappTransporter.js';
import {
  findSendProformaCompanyEmailActive,
  findSendProformaCompanyWhatsappActive,
  findSendProformaCompanyWhatsappApi,
} from '../../agents/sendProforma/data/sendProformaConfig.js';
import type { SendProformaModel } from '../../agents/sendProforma/data/sendProformaModel.js';
import { env } from '../../config/env.js';

const EMPTY_PROFORMA_ID_MESSAGE = 'El id de proforma es requerido';
const EMPTY_BRANCH_ID_MESSAGE = 'El id de sucursal es requerido';
const EMPTY_CHECKOUT_ID_MESSAGE = 'El id de caja es requerido';
const EMPTY_CLIENT_ID_MESSAGE = 'El id de cliente es requerido';
const EMPTY_PLAYMENT_METHOD_ID_MESSAGE = 'El id de método de pago es requerido';
const EMPTY_PRODUCT_CODE_MESSAGE = 'El código de producto es requerido';
const EMPTY_PRODUCT_CODE_FOR_INVENTORY_MESSAGE = 'El código de producto es requerido para items inventariables';
const INVALID_PRODUCT_CODE_MESSAGE = 'El código de producto debe ser un texto';
const EMPTY_PRODUCT_NAME_MESSAGE = 'El nombre de producto es requerido';
const INVALID_POSITIVE_ITEM_TOTAL_MESSAGE = 'El total del item debe ser mayor a cero';
const EMPTY_DETAIL_ID_MESSAGE = 'El id de detalle de proforma es requerido';
const EMPTY_ITEMS_MESSAGE = 'Los items de proforma son requeridos';
const INVALID_INVENTORIABLE_FLAG_MESSAGE = 'dprfmaesinventariable debe ser un booleano';
const INVALID_PAGE_MESSAGE = 'La página debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamaño de página debe ser un entero positivo';
const INVALID_POSITIVE_QUANTITY_MESSAGE = 'La cantidad debe ser mayor a cero';
const INVALID_POSITIVE_UNIT_PRICE_MESSAGE = 'El precio unitario debe ser mayor a cero';
const INVALID_NON_NEGATIVE_SUBTOTAL_MESSAGE = 'El subtotal debe ser mayor o igual a cero';
const INVALID_NON_NEGATIVE_DISCOUNT_MESSAGE = 'El descuento debe ser mayor o igual a cero';
const INVALID_NON_NEGATIVE_TOTAL_MESSAGE = 'El total debe ser mayor o igual a cero';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no está activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no está activo';
const FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE = 'El usuario no es jefe o empleado';
const INVALID_BRANCH_FIND_MESSAGE = 'La sucursal no existe';
const INVALID_BRANCH_STATUS_MESSAGE = 'La sucursal no está activa';
const INVALID_CHECKOUT_FIND_MESSAGE = 'La caja no existe';
const INVALID_CHECKOUT_BRANCH_MESSAGE = 'La caja no pertenece a la sucursal seleccionada';
const INVALID_CHECKOUT_STATUS_MESSAGE = 'La caja no está activa';
const INVALID_CLIENT_FIND_MESSAGE = 'El cliente no existe';
const INVALID_CLIENT_STATUS_MESSAGE = 'El cliente no está activo';
const INVALID_PLAYMENT_METHOD_FIND_MESSAGE = 'El método de pago no existe';
const INVALID_PLAYMENT_METHOD_STATUS_MESSAGE = 'El método de pago no está activo';
const INVALID_INVENTORY_PRODUCT_FIND_MESSAGE = 'El código de producto inventariable no existe';
const INVALID_INVENTORY_PRODUCT_STATUS_MESSAGE = 'El producto inventariable no está activo';
const INVALID_SEQUENCE_FIND_MESSAGE = 'La secuencia no existe para esta empresa y sucursal';
const INVALID_PROFORMA_ITEMS_DUPLICATED_PRODUCT_MESSAGE = 'La proforma tiene productos duplicados en los items';
const INVALID_PROFORMA_TOTAL_NEGATIVE_MESSAGE = 'El total de la proforma no puede ser negativo';
const INVALID_PROFORMA_SUBTOTAL_MISMATCH_MESSAGE = 'El subtotal no coincide con la suma de los items';
const INVALID_PROFORMA_TOTAL_MISMATCH_MESSAGE = 'El total no coincide con el subtotal menos el descuento';
const INVALID_PROFORMA_NOT_FOUND_MESSAGE = 'Proforma no encontrada';
const INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE = 'La proforma no tiene datos completos para enviar';
const INVALID_PROFORMA_STATUS_EDIT_MESSAGE = 'Solo las proformas emitidas pueden editarse';
const INVALID_PROFORMA_STATUS_PAY_MESSAGE = 'Solo las proformas emitidas pueden pagarse';
const INVALID_PROFORMA_STATUS_CANCEL_MESSAGE = 'Solo las proformas emitidas pueden anularse';
const INVALID_PROFORMA_STATUS_SEND_MESSAGE = 'No se puede enviar una proforma anulada';
const INVALID_PROFORMA_SEND_CHANNEL_MESSAGE = 'El canal debe ser email o whatsapp';
const INVALID_PROFORMA_CHANNEL_NOT_ACTIVE_MESSAGE = 'El canal solicitado no está activo para esta empresa';
const INVALID_PROFORMA_SEND_EMAIL_ADDRESS_MESSAGE = 'Falta correo del remitente o destinatario para enviar la proforma';
const INVALID_PROFORMA_WHATSAPP_TOKEN_MESSAGE = 'WHATSAPP_APICONSULT_TOKEN es requerido para el canal whatsapp';
const INVALID_PROFORMA_EMPTY_ITEMS_MESSAGE = 'La proforma debe contener al menos un item';
const INVALID_PROFORMA_DETAIL_REFERENCE_MESSAGE = 'El detalle de proforma no pertenece a esta proforma';
const INVALID_PROFORMA_DUPLICATED_DETAIL_MESSAGE = 'La proforma tiene ids de detalle duplicados';
const INVALID_REQUEST_NUMBER_MESSAGE = 'El valor debe ser un número válido';
const INVALID_STOCK_FIND_MESSAGE = 'El stock no existe para esta sucursal y producto';
const INVALID_STOCK_STATUS_MESSAGE = 'El stock no está activo';
const INVALID_STOCK_QUANTITY_MESSAGE = 'Cantidad de stock insuficiente';
const BAD_REQUEST_STATUS_CODE = 400;
const CONFLICT_STATUS_CODE = 409;
const DEFAULT_PROFORMA_TERMS_MESSAGE = 'Gracias por su preferencia. Esta proforma tiene validez de 15 dias.';

type AccessOptions = {
  targetCompanyId?: string;
};

type ErrorWithStatusCode = Error & {
  statusCode: number;
};

type ProformaPdfDocumentDto = {
  docnombre: string | null;
  docurl: string | null;
};

type BuildProformaResponseOptions = {
  regeneratePdf?: boolean;
};

type ValidatedCreateItem = {
  dprfmaesinventariable: boolean;
  dprfmacodigo: string | null;
  dprfmadescripcion: string;
  dprfmacantidad: number;
  dprfmapreciounitario: number;
  dprfmapreciototal: number;
};

type ValidatedReplaceItem = ValidatedCreateItem & {
  dprfmaid?: string;
};

function createErrorWithStatusCode(message: string, statusCode: number): ErrorWithStatusCode {
  const error = new Error(message) as ErrorWithStatusCode;
  error.statusCode = statusCode;

  return error;
}

function hasStatusCode(error: unknown): error is ErrorWithStatusCode {
  return error instanceof Error && 'statusCode' in error;
}

function validateReplaceInput<T>(validation: () => T): T {
  try {
    return validation();
  } catch (error) {
    if (hasStatusCode(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Invalid proforma data';
    throw createErrorWithStatusCode(message, BAD_REQUEST_STATUS_CODE);
  }
}

function validateInputString(value: unknown, emptyMessage: string): string {
  if (typeof value !== 'string') {
    throw new Error(emptyMessage);
  }

  return validateRequiredString(value, emptyMessage);
}

function validateInputNumber(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(INVALID_REQUEST_NUMBER_MESSAGE);
  }

  return validateNumber(value);
}

function parseNumericValue(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }

  return Number(value);
}

function validatePositiveNumber(value: number, invalidMessage: string): number {
  if (value <= 0) {
    throw new Error(invalidMessage);
  }

  return value;
}

function validateNonNegativeNumber(value: number, invalidMessage: string): number {
  if (value < 0) {
    throw new Error(invalidMessage);
  }

  return value;
}

function buildSendProformaTaskSnapshot(proforma: ProformaRowDao): CreateSendProformaTaskDao {
  try {
    const sendprfmaidentificador = validateRequiredString(
      proforma.prfmaidentificador ?? '',
      INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE,
    );
    const sendprfmadocumento = validateRequiredString(
      proforma.prfmadocumento ?? '',
      INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE,
    );
    const sendemruc = validateRequiredString(proforma.emruc ?? '', INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE);
    const sendemrznsocial = validateRequiredString(
      proforma.emrznsocial ?? '',
      INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE,
    );
    const sendemcorreo = proforma.emcorreo?.trim() ?? null;
    const sendclntenombre = validateRequiredString(
      proforma.clntenombre ?? '',
      INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE,
    );
    const sendclntecorreo = proforma.clntecorreo?.trim() ?? null;
    const sendclntetelefono = proforma.clntetelefono?.trim() ?? null;
    const sendsuidentificador = validateRequiredString(
      proforma.suidentificador ?? '',
      INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE,
    );
    const sendcjidentificador = validateRequiredString(
      proforma.cjidentificador ?? '',
      INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE,
    );
    const sendmpnombre = validateRequiredString(
      proforma.mpnombre ?? '',
      INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE,
    );
    const sendprfmatotal = validateNonNegativeNumber(
      parseNumericValue(proforma.prfmatotal),
      INVALID_NON_NEGATIVE_TOTAL_MESSAGE,
    );

    return {
      sendemid: proforma.prfmaemid,
      sendprfmaid: proforma.prfmaid,
      sendprfmaidentificador,
      sendprfmadocumento,
      sendemruc,
      sendemrznsocial,
      sendemcorreo,
      sendclntenombre,
      sendclntecorreo,
      sendclntetelefono,
      sendprfmatotal,
      sendsuidentificador,
      sendcjidentificador,
      sendmpnombre,
    };
  } catch {
    throw createErrorWithStatusCode(INVALID_PROFORMA_SEND_SNAPSHOT_MESSAGE, CONFLICT_STATUS_CODE);
  }
}

function validateFindProformasParams(params: FindProformasParamsDto): FindProformasParamsDto {
  const { page, pageSize, search, status } = params;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(INVALID_PAGE_MESSAGE);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(INVALID_PAGE_SIZE_MESSAGE);
  }

  const normalizedSearch = typeof search === 'string'
    ? search.trim()
    : undefined;

  const validatedParams: FindProformasParamsDto = {
    page,
    pageSize,
  };

  if (normalizedSearch && normalizedSearch.length > 0) {
    validatedParams.search = normalizedSearch;
  }

  if (status) {
    validatedParams.status = status;
  }

  return validatedParams;
}

function validateInventariableFlag(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(INVALID_INVENTORIABLE_FLAG_MESSAGE);
  }

  return value;
}

function validateProformaItem(
  item: CreateProformaDto['dprfmaproductos'][number],
): ValidatedCreateItem {
  const dprfmaesinventariable = validateInventariableFlag(item.dprfmaesinventariable);
  const dprfmacantidad = validatePositiveNumber(
    validateNumber(item.dprfmacantidad),
    INVALID_POSITIVE_QUANTITY_MESSAGE,
  );
  const dprfmapreciounitario = validatePositiveNumber(
    validateNumber(item.dprfmapreciounitario),
    INVALID_POSITIVE_UNIT_PRICE_MESSAGE,
  );
  const dprfmadescripcion = validateRequiredString(item.dprfmadescripcion ?? '', EMPTY_PRODUCT_NAME_MESSAGE);
  const dprfmapreciototal = validatePositiveNumber(
    validateNumber(item.dprfmapreciototal),
    INVALID_POSITIVE_ITEM_TOTAL_MESSAGE,
  );
  const rawCode = typeof item.dprfmacodigo === 'string' ? item.dprfmacodigo.trim() : '';
  const dprfmacodigo = dprfmaesinventariable
    ? validateRequiredString(rawCode, EMPTY_PRODUCT_CODE_FOR_INVENTORY_MESSAGE)
    : (rawCode.length > 0 ? validateRequiredString(rawCode, EMPTY_PRODUCT_CODE_MESSAGE) : null);

  return {
    dprfmaesinventariable,
    dprfmacodigo,
    dprfmadescripcion,
    dprfmacantidad,
    dprfmapreciounitario,
    dprfmapreciototal,
  };
}

function validateCreateItems(items: CreateProformaDto['dprfmaproductos']): ValidatedCreateItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(EMPTY_ITEMS_MESSAGE);
  }

  const duplicatedChecker = new Set<string>();

  return items.map((item) => {
    const validatedItem = validateProformaItem(item);

    if (
      validatedItem.dprfmaesinventariable
      && validatedItem.dprfmacodigo
      && duplicatedChecker.has(validatedItem.dprfmacodigo.toLowerCase())
    ) {
      throw createErrorWithStatusCode(
        INVALID_PROFORMA_ITEMS_DUPLICATED_PRODUCT_MESSAGE,
        CONFLICT_STATUS_CODE,
      );
    }

    if (validatedItem.dprfmaesinventariable && validatedItem.dprfmacodigo) {
      duplicatedChecker.add(validatedItem.dprfmacodigo.toLowerCase());
    }

    return validatedItem;
  });
}

function validateReplaceItems(items: unknown): ValidatedReplaceItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(EMPTY_ITEMS_MESSAGE);
  }

  const duplicatedProductChecker = new Set<string>();
  const duplicatedDetailChecker = new Set<string>();

  return items.map((rawItem) => {
    if (typeof rawItem !== 'object' || rawItem === null) {
      throw new Error(EMPTY_ITEMS_MESSAGE);
    }

    const item = rawItem as Partial<ReplaceProformaDto['dprfmaproductos'][number]>;
    const dprfmaesinventariable = validateInventariableFlag(item.dprfmaesinventariable);
    const dprfmacantidad = validatePositiveNumber(
      validateInputNumber(item.dprfmacantidad),
      INVALID_POSITIVE_QUANTITY_MESSAGE,
    );
    const dprfmapreciounitario = validatePositiveNumber(
      validateInputNumber(item.dprfmapreciounitario),
      INVALID_POSITIVE_UNIT_PRICE_MESSAGE,
    );
    const dprfmadescripcion = validateInputString(item.dprfmadescripcion, EMPTY_PRODUCT_NAME_MESSAGE);
    const dprfmapreciototal = validatePositiveNumber(
      validateInputNumber(item.dprfmapreciototal),
      INVALID_POSITIVE_ITEM_TOTAL_MESSAGE,
    );

    if (
      item.dprfmacodigo !== undefined
      && item.dprfmacodigo !== null
      && typeof item.dprfmacodigo !== 'string'
    ) {
      throw new Error(INVALID_PRODUCT_CODE_MESSAGE);
    }

    const rawCode = typeof item.dprfmacodigo === 'string' ? item.dprfmacodigo.trim() : '';
    const dprfmacodigo = dprfmaesinventariable
      ? validateRequiredString(rawCode, EMPTY_PRODUCT_CODE_FOR_INVENTORY_MESSAGE)
      : (rawCode.length > 0 ? validateRequiredString(rawCode, EMPTY_PRODUCT_CODE_MESSAGE) : null);
    const validatedItem: ValidatedReplaceItem = {
      dprfmaesinventariable,
      dprfmacodigo,
      dprfmadescripcion,
      dprfmacantidad,
      dprfmapreciounitario,
      dprfmapreciototal,
    };

    if (item.dprfmaid !== undefined) {
      const dprfmaid = validateInputString(item.dprfmaid, EMPTY_DETAIL_ID_MESSAGE);

      if (duplicatedDetailChecker.has(dprfmaid)) {
        throw createErrorWithStatusCode(INVALID_PROFORMA_DUPLICATED_DETAIL_MESSAGE, CONFLICT_STATUS_CODE);
      }

      duplicatedDetailChecker.add(dprfmaid);
      validatedItem.dprfmaid = dprfmaid;
    }

    if (
      dprfmaesinventariable
      && dprfmacodigo
      && duplicatedProductChecker.has(dprfmacodigo.toLowerCase())
    ) {
      throw createErrorWithStatusCode(
        INVALID_PROFORMA_ITEMS_DUPLICATED_PRODUCT_MESSAGE,
        CONFLICT_STATUS_CODE,
      );
    }

    if (dprfmaesinventariable && dprfmacodigo) {
      duplicatedProductChecker.add(dprfmacodigo.toLowerCase());
    }

    return validatedItem;
  });
}

async function validateCompanyAndUserAccess(user: LoginUserDto, options: AccessOptions): Promise<void> {
  const { targetCompanyId } = options;

  const companyDB = await findCompanyById(user.usemid);
  if (!companyDB) {
    throw new Error(INVALID_COMPANY_FIND_MESSAGE);
  }

  if (companyDB.emestado !== 'activo') {
    throw new Error(INVALID_COMPANY_STATUS_MESSAGE);
  }

  const userDB = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!userDB) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  if (userDB.usemid !== user.usemid) {
    throw new Error(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE);
  }

  if (userDB.usestado !== 'activo') {
    throw new Error(INVALID_USER_STATUS_MESSAGE);
  }

  if (!['jefe', 'empleado'].includes(userDB.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE);
  }

  if (targetCompanyId && targetCompanyId !== user.usemid) {
    throw new Error(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE);
  }
}

async function validateBranchActive(companyId: string, branchId: string): Promise<{ suidentificador: string }> {
  const branchDB = await findBranchById({
    suemid: companyId,
    suid: branchId,
  });

  if (!branchDB) {
    throw new Error(INVALID_BRANCH_FIND_MESSAGE);
  }

  if (branchDB.suestado !== 'activo') {
    throw new Error(INVALID_BRANCH_STATUS_MESSAGE);
  }

  return {
    suidentificador: branchDB.suidentificador,
  };
}

async function validateCheckoutActive(
  companyId: string,
  branchId: string,
  checkoutId: string,
): Promise<{ cjidentificador: string }> {
  const checkoutDB = await findCheckoutByRowId({
    cjid: checkoutId,
    cjemid: companyId,
  });

  if (!checkoutDB) {
    throw new Error(INVALID_CHECKOUT_FIND_MESSAGE);
  }

  if (checkoutDB.cjsuid !== branchId) {
    throw new Error(INVALID_CHECKOUT_BRANCH_MESSAGE);
  }

  if (checkoutDB.cjestado !== 'activo') {
    throw new Error(INVALID_CHECKOUT_STATUS_MESSAGE);
  }

  return {
    cjidentificador: checkoutDB.cjidentificador,
  };
}

async function validateClientActive(companyId: string, clientId: string): Promise<void> {
  const clientDB = await findClientById({
    clnteemid: companyId,
    clnteid: clientId,
  });

  if (!clientDB) {
    throw new Error(INVALID_CLIENT_FIND_MESSAGE);
  }

  if (clientDB.clnteestado !== 'activo') {
    throw new Error(INVALID_CLIENT_STATUS_MESSAGE);
  }
}

async function validatePlaymentMethodActive(companyId: string, playmentMethodId: string): Promise<void> {
  const playmentMethodDB = await findPlaymentMethodById({
    mpemid: companyId,
    mpid: playmentMethodId,
  });

  if (!playmentMethodDB) {
    throw new Error(INVALID_PLAYMENT_METHOD_FIND_MESSAGE);
  }

  if (playmentMethodDB.mpestado !== 'activo') {
    throw new Error(INVALID_PLAYMENT_METHOD_STATUS_MESSAGE);
  }
}

async function validateInventariableProductsActive(
  companyId: string,
  items: ReadonlyArray<ValidatedCreateItem>,
): Promise<void> {
  for (const item of items) {
    if (!item.dprfmaesinventariable || !item.dprfmacodigo) {
      continue;
    }

    const productDB = await findProductByCode({
      prdtoemid: companyId,
      prdtocodigo: item.dprfmacodigo,
    });

    if (!productDB) {
      throw createErrorWithStatusCode(INVALID_INVENTORY_PRODUCT_FIND_MESSAGE, CONFLICT_STATUS_CODE);
    }

    if (productDB.prdtoestado !== 'activo') {
      throw createErrorWithStatusCode(INVALID_INVENTORY_PRODUCT_STATUS_MESSAGE, CONFLICT_STATUS_CODE);
    }
  }
}

function mapProformaToPdfInput(proforma: ProformaRowDao, items: ProformaItemRowDao[]): ProformaPdfInput {
  const subtotal = parseNumericValue(proforma.prfmasubtotal ?? 0);
  const descuento = parseNumericValue(proforma.prfmadescuento);
  const total = parseNumericValue(proforma.prfmatotal);

  const empresa: ProformaPdfInput['empresa'] = {
    ruc: proforma.emruc ?? 'N/A',
    razonSocial: proforma.emrznsocial ?? 'Empresa',
  };

  if (proforma.emcorreo) {
    empresa.correo = proforma.emcorreo;
  }

  const cliente: ProformaPdfInput['cliente'] = {
    nombre: proforma.clntenombre ?? 'Cliente',
  };

  if (proforma.clnteidentificacion) {
    cliente.identificación = proforma.clnteidentificacion;
  }

  if (proforma.clntecorreo) {
    cliente.correo = proforma.clntecorreo;
  }

  if (proforma.clntedireccion) {
    cliente.dirección = proforma.clntedireccion;
  }

  if (proforma.clntetelefono) {
    cliente.teléfono = proforma.clntetelefono;
  }

  const detalle: ProformaPdfInput['detalle'] = items.map((item) => {
    const itemPdf: ProformaPdfInput['detalle'][number] = {
      descripcion: item.dprfmadescripcion,
      cantidad: parseNumericValue(item.dprfmacantidad),
      precioUnitario: parseNumericValue(item.dprfmapreciounitario),
      precioTotal: parseNumericValue(item.dprfmapreciototal),
    };

    if (item.dprfmacodigo) {
      itemPdf.código = item.dprfmacodigo;
    }

    return itemPdf;
  });

  const branding: ProformaPdfInput['branding'] = {
    termsMessage: DEFAULT_PROFORMA_TERMS_MESSAGE,
  };

  return {
    identificador: proforma.prfmaidentificador,
    fechaEmision: proforma.prfmafchactualizacion ?? proforma.prfmafchregistro ?? new Date(),
    estado: proforma.prfmaestado,
    empresa,
    cliente,
    metodoPago: proforma.mpnombre ?? 'No especificado',
    detalle,
    totales: {
      subtotal,
      descuento,
      total,
    },
    branding,
    outputFileName: buildProformaFileName(
      proforma.prfmaidentificador,
      proforma.prfmafchregistro ?? proforma.prfmafchactualizacion ?? new Date(),
    ),
  };
}

async function resolveStoredProformaPdfDocument(proforma: ProformaRowDao): Promise<ProformaPdfDocumentDto> {
  if (proforma.prfmadocumento) {
    const normalizedStoredPath = `/${proforma.prfmadocumento.replaceAll('\\', '/').replace(/^\/+/, '')}`;

    try {
      await access(resolve(process.cwd(), `.${normalizedStoredPath}`));

      return {
        docnombre: basename(normalizedStoredPath),
        docurl: toPublicImageUrl(normalizedStoredPath),
      };
    } catch {
      logger.warn(
        {
          proformaId: proforma.prfmaid,
          companyId: proforma.prfmaemid,
          storedPath: normalizedStoredPath,
        },
        'Stored proforma pdf path does not exist in filesystem',
      );
    }
  }

  const createdAt = proforma.prfmafchregistro ?? proforma.prfmafchactualizacion ?? new Date();
  const preferredFileName = buildProformaFileName(proforma.prfmaidentificador, createdAt);
  const legacyFileName = `proforma_${proforma.prfmaid}.pdf`;
  const companyRuc = proforma.emruc ?? 'N/A';
  const candidates = [
    { fileName: preferredFileName, companyRuc },
    { fileName: preferredFileName },
    { fileName: legacyFileName },
  ];

  for (const candidate of candidates) {
    const absolutePath = buildProformaPdfAbsolutePath(candidate.fileName, candidate.companyRuc);

    try {
      await access(absolutePath);
    } catch {
      continue;
    }

    const rutaRelativa = buildProformaPdfRelativePath(candidate.fileName, candidate.companyRuc);

    return {
      docnombre: candidate.fileName,
      docurl: toPublicImageUrl(rutaRelativa),
    };
  }

  return {
    docnombre: null,
    docurl: null,
  };
}

async function generateProformaPdfDocument(
  proforma: ProformaRowDao,
  items: ProformaItemRowDao[],
): Promise<ProformaPdfDocumentDto> {
  const pdfInput = mapProformaToPdfInput(proforma, items);

  try {
    const pdfResult = await generateProformaPdf(pdfInput);
    const rutaRelativa = buildProformaPdfRelativePath(pdfResult.fileName, proforma.emruc ?? 'N/A');
    const documentPathSaved = await updateProformaDocumentPathById(
      {
        prfmaemid: proforma.prfmaemid,
        prfmaid: proforma.prfmaid,
      },
      rutaRelativa,
    );

    if (!documentPathSaved) {
      throw new Error('La ruta del documento PDF de proforma no fue guardada');
    }

    return {
      docnombre: pdfResult.fileName,
      docurl: toPublicImageUrl(rutaRelativa),
    };
  } catch (error) {
    logger.error(
      {
        err: error,
        proformaId: proforma.prfmaid,
        companyId: proforma.prfmaemid,
      },
      'Error generating proforma pdf document',
    );

    return {
      docnombre: null,
      docurl: null,
    };
  }
}

function mapProformaResponse(
  proforma: ProformaRowDao,
  items: ProformaItemRowDao[],
  documentoPdf: ProformaPdfDocumentDto,
): ProformaResponseDto {
  return {
    proforma: {
      prfmaid: proforma.prfmaid,
      prfmaidentificador: proforma.prfmaidentificador,
      prfmaestado: proforma.prfmaestado,
      prfmafchregistro: proforma.prfmafchregistro,
      prfmafchactualizacion: proforma.prfmafchactualizacion,
      emisor: {
        empresa: {
          emid: proforma.prfmaemid,
          emlogo: proforma.emlogo ? toPublicImageUrl(proforma.emlogo) : null,
          emrznsocial: proforma.emrznsocial ?? null,
          emruc: proforma.emruc ?? null,
          emcorreo: proforma.emcorreo ?? null,
          emcodigo: proforma.emcodigo ?? null,
        },
        sucursal: {
          suid: proforma.prfmasuid,
          sunombre: proforma.sunombre ?? null,
          suidentificador: proforma.suidentificador ?? null,
        },
        caja: {
          cjid: proforma.prfmacjid,
          cjidentificador: proforma.cjidentificador ?? null,
        },
        usuario: {
          usid: proforma.prfmausid,
          usnombre: proforma.usnombre ?? null,
          usrol: proforma.usrol ?? null,
        },
      },
      receptor: {
        cliente: {
          clnteid: proforma.prfmaclnteid,
          clntenombre: proforma.clntenombre ?? null,
          clnteidentificacion: proforma.clnteidentificacion ?? null,
          clntecorreo: proforma.clntecorreo ?? null,
          clntetelefono: proforma.clntetelefono ?? null,
          clntedireccion: proforma.clntedireccion ?? null,
        },
      },
      metodoPago: {
        mpid: proforma.prfmampid,
        mpnombre: proforma.mpnombre ?? null,
      },
      detalle: items.map((item) => {
        return {
          dprfmaid: item.dprfmaid,
          dprfmatipoitem: item.dprfmaesinventariable ? 'inventariable' as const : 'manual' as const,
          producto: {
            dprfmacodigo: item.dprfmacodigo ?? null,
            dprfmadescripcion: item.dprfmadescripcion ?? null,
            dprfmacantidad: parseNumericValue(item.dprfmacantidad),
            dprfmapreciounitario: parseNumericValue(item.dprfmapreciounitario),
            dprfmapreciototal: parseNumericValue(item.dprfmapreciototal),
          },
        };
      }),
      total: {
        prfmasubtotal: parseNumericValue(proforma.prfmasubtotal ?? 0),
        prfmadescuento: parseNumericValue(proforma.prfmadescuento),
        prfmatotal: parseNumericValue(proforma.prfmatotal),
      },
      documento: {
        docnombre: documentoPdf.docnombre,
        docurl: documentoPdf.docurl,
      },
    },
  };
}

function validateEmitidaStatus(status: ProformaStatus, invalidMessage: string): void {
  if (status !== 'emitida') {
    throw createErrorWithStatusCode(invalidMessage, CONFLICT_STATUS_CODE);
  }
}

function calculateTotalOrThrow(subtotal: number, discount: number): number {
  const total = subtotal - discount;

  if (total < 0) {
    throw createErrorWithStatusCode(INVALID_PROFORMA_TOTAL_NEGATIVE_MESSAGE, CONFLICT_STATUS_CODE);
  }

  return total;
}

async function createProforma(proforma: CreateProformaDto, user: LoginUserDto): Promise<ProformaResponseDto> {
  const prfmaemid = user.usemid;
  const prfmausid = user.usid;
  const prfmasuid = validateRequiredString(proforma.prfmasuid, EMPTY_BRANCH_ID_MESSAGE);
  const prfmacjid = validateRequiredString(proforma.prfmacjid, EMPTY_CHECKOUT_ID_MESSAGE);
  const prfmaclnteid = validateRequiredString(proforma.prfmaclnteid, EMPTY_CLIENT_ID_MESSAGE);
  const prfmampid = validateRequiredString(proforma.prfmampid, EMPTY_PLAYMENT_METHOD_ID_MESSAGE);
  const prfmasubtotal = validateNonNegativeNumber(
    validateNumber(proforma.prfmasubtotal),
    INVALID_NON_NEGATIVE_SUBTOTAL_MESSAGE,
  );
  const prfmadescuento = proforma.prfmadescuento !== undefined
    ? validateNonNegativeNumber(validateNumber(proforma.prfmadescuento), INVALID_NON_NEGATIVE_DISCOUNT_MESSAGE)
    : 0;
  const prfmatotal = validateNonNegativeNumber(
    validateNumber(proforma.prfmatotal),
    INVALID_NON_NEGATIVE_TOTAL_MESSAGE,
  );
  const validatedItems = validateCreateItems(proforma.dprfmaproductos);

  try {
    await validateCompanyAndUserAccess(user, { targetCompanyId: prfmaemid });

    const companyDB = await findCompanyById(prfmaemid);
    if (!companyDB) {
      throw new Error(INVALID_COMPANY_FIND_MESSAGE);
    }

    const branchDB = await validateBranchActive(prfmaemid, prfmasuid);
    const checkoutDB = await validateCheckoutActive(prfmaemid, prfmasuid, prfmacjid);
    await validateClientActive(prfmaemid, prfmaclnteid);
    await validatePlaymentMethodActive(prfmaemid, prfmampid);
    await validateInventariableProductsActive(prfmaemid, validatedItems);
    const subtotalFromItems = validatedItems.reduce((acc, item) => acc + item.dprfmapreciototal, 0);
    const expectedTotal = calculateTotalOrThrow(prfmasubtotal, prfmadescuento);

    if (Math.abs(subtotalFromItems - prfmasubtotal) > 0.0001) {
      throw createErrorWithStatusCode(INVALID_PROFORMA_SUBTOTAL_MISMATCH_MESSAGE, CONFLICT_STATUS_CODE);
    }

    if (Math.abs(expectedTotal - prfmatotal) > 0.0001) {
      throw createErrorWithStatusCode(INVALID_PROFORMA_TOTAL_MISMATCH_MESSAGE, CONFLICT_STATUS_CODE);
    }

    const sequence = await incrementSequenceByCompanyAndBranch(prfmaemid, prfmasuid);
    if (sequence === null) {
      throw createErrorWithStatusCode(INVALID_SEQUENCE_FIND_MESSAGE, CONFLICT_STATUS_CODE);
    }

    const prfmaidentificador = `${companyDB.emcodigo}-${branchDB.suidentificador}-${checkoutDB.cjidentificador}-${sequence}`;

    const proformaId = await saveProformaHeader({
      prfmaemid,
      prfmasuid,
      prfmacjid,
      prfmausid,
      prfmaclnteid,
      prfmampid,
      prfmaidentificador,
      prfmasubtotal,
      prfmadescuento,
      prfmatotal,
    });

    for (const item of validatedItems) {
      await saveProformaItem({
        dprfmaprfmaid: proformaId,
        dprfmaesinventariable: item.dprfmaesinventariable,
        dprfmacodigo: item.dprfmacodigo,
        dprfmadescripcion: item.dprfmadescripcion,
        dprfmacantidad: item.dprfmacantidad,
        dprfmapreciounitario: item.dprfmapreciounitario,
        dprfmapreciototal: item.dprfmapreciototal,
      });
    }

    return await buildProformaResponseOrThrow(prfmaemid, proformaId, { regeneratePdf: true });
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: prfmaemid,
        branchId: prfmasuid,
        checkoutId: prfmacjid,
        clientId: prfmaclnteid,
        playmentMethodId: prfmampid,
        requesterUserId: user.usid,
      },
      'Error creating proforma',
    );
    throw error;
  }
}

async function buildProformaResponseOrThrow(
  companyId: string,
  proformaId: string,
  options: BuildProformaResponseOptions = {},
): Promise<ProformaResponseDto> {
  const proformaDB = await findProformaById({
    prfmaemid: companyId,
    prfmaid: proformaId,
  });

  if (!proformaDB) {
    throw new Error(INVALID_PROFORMA_NOT_FOUND_MESSAGE);
  }

  const itemsDB = await findProformaItems({
    prfmaemid: companyId,
    prfmaid: proformaId,
  });

  const documentoPdf = options.regeneratePdf
    ? await generateProformaPdfDocument(proformaDB, itemsDB)
    : await resolveStoredProformaPdfDocument(proformaDB);

  return mapProformaResponse(proformaDB, itemsDB, documentoPdf);
}

async function regenerateProformaAfterStatusChange(
  companyId: string,
  proformaId: string,
  items?: ProformaItemRowDao[],
): Promise<ProformaRowDao> {
  const proformaDB = await findProformaById({
    prfmaemid: companyId,
    prfmaid: proformaId,
  });

  if (!proformaDB) {
    throw new Error(INVALID_PROFORMA_NOT_FOUND_MESSAGE);
  }

  const itemsDB = items ?? await findProformaItems({
    prfmaemid: companyId,
    prfmaid: proformaId,
  });

  await generateProformaPdfDocument(proformaDB, itemsDB);

  const refreshedProformaDB = await findProformaById({
    prfmaemid: companyId,
    prfmaid: proformaId,
  });

  if (!refreshedProformaDB) {
    throw new Error(INVALID_PROFORMA_NOT_FOUND_MESSAGE);
  }

  return refreshedProformaDB;
}

async function readProformas(
  params: FindProformasParamsDto,
  user: LoginUserDto,
): Promise<FindProformasResponseDto> {
  const validatedParams = validateFindProformasParams(params);

  try {
    await validateCompanyAndUserAccess(user, { targetCompanyId: user.usemid });

    const proformasDB = await findProformas(validatedParams, user.usemid);
    const fullProformas = await Promise.all(
      proformasDB.items.map(async (item) => {
        return await buildProformaResponseOrThrow(user.usemid, item.prfmaid);
      }),
    );

    return {
      items: fullProformas,
      page: proformasDB.page,
      pageSize: proformasDB.pageSize,
      totalItems: proformasDB.totalItems,
      totalPages: proformasDB.totalPages,
    };
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: user.usemid,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
      },
      'Error reading proformas',
    );
    throw error;
  }
}

async function readProforma(proforma: FindProformaDto, user: LoginUserDto): Promise<ProformaResponseDto | null> {
  const prfmaid = validateRequiredString(proforma.prfmaid, EMPTY_PROFORMA_ID_MESSAGE);

  try {
    await validateCompanyAndUserAccess(user, { targetCompanyId: user.usemid });

    const proformaDB = await findProformaById({
      prfmaemid: user.usemid,
      prfmaid,
    });

    if (!proformaDB) {
      return null;
    }

    const itemsDB = await findProformaItems({
      prfmaemid: user.usemid,
      prfmaid,
    });

    const documentoPdf = await resolveStoredProformaPdfDocument(proformaDB);
    return mapProformaResponse(proformaDB, itemsDB, documentoPdf);
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: user.usemid,
        proformaId: prfmaid,
        requesterUserId: user.usid,
      },
      'Error reading proforma',
    );
    throw error;
  }
}

async function readProformaPdfDocument(
  proforma: FindProformaDto,
  user: LoginUserDto,
): Promise<ProformaPdfResponseDto | null> {
  const prfmaid = validateRequiredString(proforma.prfmaid, EMPTY_PROFORMA_ID_MESSAGE);

  try {
    await validateCompanyAndUserAccess(user, { targetCompanyId: user.usemid });

    const proformaDB = await findProformaById({
      prfmaemid: user.usemid,
      prfmaid,
    });

    if (!proformaDB) {
      return null;
    }

    const documentoPdf = await resolveStoredProformaPdfDocument(proformaDB);

    return {
      proforma: {
        prfmaid: proformaDB.prfmaid,
        prfmaidentificador: proformaDB.prfmaidentificador,
        documento: {
          docnombre: documentoPdf.docnombre,
          docurl: documentoPdf.docurl,
        },
      },
    };
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: user.usemid,
        proformaId: prfmaid,
        requesterUserId: user.usid,
      },
      'Error reading proforma pdf document',
    );
    throw error;
  }
}

async function replaceProforma(proforma: ReplaceProformaDto, user: LoginUserDto): Promise<ProformaResponseDto | null> {
  const prfmaid = validateReplaceInput(() => validateInputString(proforma.prfmaid, EMPTY_PROFORMA_ID_MESSAGE));
  const prfmaclnteid = validateReplaceInput(() => validateInputString(proforma.prfmaclnteid, EMPTY_CLIENT_ID_MESSAGE));
  const prfmampid = validateReplaceInput(() => validateInputString(proforma.prfmampid, EMPTY_PLAYMENT_METHOD_ID_MESSAGE));
  const prfmasubtotal = validateReplaceInput(() => validateNonNegativeNumber(
    validateInputNumber(proforma.prfmasubtotal),
    INVALID_NON_NEGATIVE_SUBTOTAL_MESSAGE,
  ));
  const prfmadescuento = validateReplaceInput(() => validateNonNegativeNumber(
    validateInputNumber(proforma.prfmadescuento),
    INVALID_NON_NEGATIVE_DISCOUNT_MESSAGE,
  ));
  const prfmatotal = validateReplaceInput(() => validateNonNegativeNumber(
    validateInputNumber(proforma.prfmatotal),
    INVALID_NON_NEGATIVE_TOTAL_MESSAGE,
  ));
  const validatedItems = validateReplaceInput(() => validateReplaceItems(proforma.dprfmaproductos));

  try {
    await validateCompanyAndUserAccess(user, { targetCompanyId: user.usemid });

    const proformaDB = await findProformaHeaderForUpdate({
      prfmaemid: user.usemid,
      prfmaid,
    });

    if (!proformaDB) {
      return null;
    }

    validateEmitidaStatus(proformaDB.prfmaestado, INVALID_PROFORMA_STATUS_EDIT_MESSAGE);
    await validateClientActive(user.usemid, prfmaclnteid);
    await validatePlaymentMethodActive(user.usemid, prfmampid);
    await validateInventariableProductsActive(user.usemid, validatedItems);

    const subtotalFromItems = validatedItems.reduce((acc, item) => acc + item.dprfmapreciototal, 0);
    const expectedTotal = calculateTotalOrThrow(prfmasubtotal, prfmadescuento);

    if (Math.abs(subtotalFromItems - prfmasubtotal) > 0.0001) {
      throw createErrorWithStatusCode(INVALID_PROFORMA_SUBTOTAL_MISMATCH_MESSAGE, CONFLICT_STATUS_CODE);
    }

    if (Math.abs(expectedTotal - prfmatotal) > 0.0001) {
      throw createErrorWithStatusCode(INVALID_PROFORMA_TOTAL_MISMATCH_MESSAGE, CONFLICT_STATUS_CODE);
    }

    const itemsDB: ReplaceCompleteProformaItemDao[] = validatedItems.map((item) => {
      const itemDB: ReplaceCompleteProformaItemDao = {
        dprfmaesinventariable: item.dprfmaesinventariable,
        dprfmacodigo: item.dprfmacodigo,
        dprfmadescripcion: item.dprfmadescripcion,
        dprfmacantidad: item.dprfmacantidad,
        dprfmapreciounitario: item.dprfmapreciounitario,
        dprfmapreciototal: item.dprfmapreciototal,
      };

      if (item.dprfmaid !== undefined) {
        itemDB.dprfmaid = item.dprfmaid;
      }

      return itemDB;
    });
    const result = await replaceCompleteProforma({
      prfmaemid: user.usemid,
      prfmaid,
      prfmaclnteid,
      prfmampid,
      prfmasubtotal,
      prfmadescuento,
      prfmatotal,
      items: itemsDB,
    });

    if (result === 'not_found') {
      return null;
    }

    if (result === 'invalid_status') {
      throw createErrorWithStatusCode(INVALID_PROFORMA_STATUS_EDIT_MESSAGE, CONFLICT_STATUS_CODE);
    }

    if (result === 'invalid_detail') {
      throw createErrorWithStatusCode(INVALID_PROFORMA_DETAIL_REFERENCE_MESSAGE, CONFLICT_STATUS_CODE);
    }

    return await buildProformaResponseOrThrow(user.usemid, prfmaid, { regeneratePdf: true });
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: user.usemid,
        proformaId: prfmaid,
        requesterUserId: user.usid,
      },
      'Error replacing complete proforma',
    );
    throw error;
  }
}

async function payProforma(proforma: ProformaActionDto, user: LoginUserDto): Promise<ProformaResponseDto | null> {
  const prfmaid = validateRequiredString(proforma.prfmaid, EMPTY_PROFORMA_ID_MESSAGE);

  try {
    await validateCompanyAndUserAccess(user, { targetCompanyId: user.usemid });

    const proformaDB = await findProformaHeaderForUpdate({
      prfmaemid: user.usemid,
      prfmaid,
    });

    if (!proformaDB) {
      return null;
    }

    validateEmitidaStatus(proformaDB.prfmaestado, INVALID_PROFORMA_STATUS_PAY_MESSAGE);

    const itemsDB = await findProformaItems({
      prfmaemid: user.usemid,
      prfmaid,
    });

    if (itemsDB.length === 0) {
      throw createErrorWithStatusCode(INVALID_PROFORMA_EMPTY_ITEMS_MESSAGE, CONFLICT_STATUS_CODE);
    }

    for (const item of itemsDB) {
      if (!item.dprfmaesinventariable) {
        continue;
      }

      const itemCode = item.dprfmacodigo ?? null;
      if (!itemCode) {
        continue;
      }

      const productDB = await findProductByCode({
        prdtoemid: user.usemid,
        prdtocodigo: itemCode,
      });

      if (!productDB || productDB.prdtoestado !== 'activo') {
        continue;
      }

      const stockDB = await findStockByProductId({
        stckemid: user.usemid,
        stcksuid: proformaDB.prfmasuid,
        stckprdtoid: productDB.prdtoid,
      });

      if (!stockDB) {
        throw createErrorWithStatusCode(INVALID_STOCK_FIND_MESSAGE, CONFLICT_STATUS_CODE);
      }

      if (stockDB.stckestado !== 'activo') {
        throw createErrorWithStatusCode(INVALID_STOCK_STATUS_MESSAGE, CONFLICT_STATUS_CODE);
      }

      const availableQuantity = parseNumericValue(stockDB.stckcantidad);
      const requiredQuantity = parseNumericValue(item.dprfmacantidad);

      if (availableQuantity < requiredQuantity) {
        throw createErrorWithStatusCode(INVALID_STOCK_QUANTITY_MESSAGE, CONFLICT_STATUS_CODE);
      }

      const newQuantity = availableQuantity - requiredQuantity;

      const updateStockData: UpdateColumnStockDao[] = [
        { column: 'stckcantidad', value: newQuantity },
        { column: 'stckfchactualizacion', value: new Date() },
      ];

      await updateStockById(updateStockData, {
        stckid: stockDB.stckid,
        stckemid: user.usemid,
        stcksuid: proformaDB.prfmasuid,
      });
    }

    await updateProformaStatusById(
      {
        prfmaemid: user.usemid,
        prfmaid,
      },
      'pagada',
    );

    const paidProformaDB = await regenerateProformaAfterStatusChange(user.usemid, prfmaid, itemsDB);

    const sendProformaTask = buildSendProformaTaskSnapshot(paidProformaDB);
    await saveSendProformaTask(sendProformaTask);

    return await buildProformaResponseOrThrow(user.usemid, prfmaid);
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: user.usemid,
        proformaId: prfmaid,
        requesterUserId: user.usid,
      },
      'Error paying proforma',
    );
    throw error;
  }
}

async function cancelProforma(
  proforma: ProformaActionDto,
  user: LoginUserDto,
): Promise<ProformaResponseDto | null> {
  const prfmaid = validateRequiredString(proforma.prfmaid, EMPTY_PROFORMA_ID_MESSAGE);

  try {
    await validateCompanyAndUserAccess(user, { targetCompanyId: user.usemid });

    const proformaDB = await findProformaHeaderForUpdate({
      prfmaemid: user.usemid,
      prfmaid,
    });

    if (!proformaDB) {
      return null;
    }

    validateEmitidaStatus(proformaDB.prfmaestado, INVALID_PROFORMA_STATUS_CANCEL_MESSAGE);

    await updateProformaStatusById(
      {
        prfmaemid: user.usemid,
        prfmaid,
      },
      'anulada',
    );

    await regenerateProformaAfterStatusChange(user.usemid, prfmaid);

    return await buildProformaResponseOrThrow(user.usemid, prfmaid);
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: user.usemid,
        proformaId: prfmaid,
        requesterUserId: user.usid,
      },
      'Error canceling proforma',
    );
    throw error;
  }
}

function buildProformaSnapshot(proforma: ProformaRowDao): SendProformaModel {
  return {
    sendid: '',
    sendemid: proforma.prfmaemid,
    sendprfmaid: proforma.prfmaid,
    sendprfmaidentificador: proforma.prfmaidentificador ?? '',
    sendprfmadocumento: proforma.prfmadocumento ?? '',
    sendemruc: proforma.emruc ?? '',
    sendemrznsocial: proforma.emrznsocial ?? '',
    sendemcorreo: proforma.emcorreo?.trim() ?? null,
    sendclntenombre: proforma.clntenombre ?? '',
    sendclntecorreo: proforma.clntecorreo?.trim() ?? null,
    sendclntetelefono: proforma.clntetelefono?.trim() ?? null,
    sendprfmatotal: parseNumericValue(proforma.prfmatotal),
    sendsuidentificador: proforma.suidentificador ?? '',
    sendcjidentificador: proforma.cjidentificador ?? '',
    sendmpnombre: proforma.mpnombre ?? '',
    sendestado: 'pendiente',
    sendintentos: 0,
    senderror: null,
    sendfchcreacion: new Date(),
    sendfchactualizacion: new Date(),
  };
}

async function sendProformaEmail(snapshot: SendProformaModel): Promise<void> {
  const fromAddress = env.smtpFrom ?? snapshot.sendemcorreo;
  const recipientEmail = snapshot.sendclntecorreo;

  if (!fromAddress || !recipientEmail) {
    throw new Error(INVALID_PROFORMA_SEND_EMAIL_ADDRESS_MESSAGE);
  }

  const documentPath = resolveDocumentPath(snapshot.sendprfmadocumento);
  const emailHtml = await buildSendProformaEmailBody(snapshot);
  const transporter = await getCompanyTransporter(snapshot.sendemid);

  await validateDocumentAccess(documentPath);

  await sendEmail(transporter, {
    from: fromAddress,
    to: [recipientEmail],
    subject: `Proforma ${snapshot.sendprfmaidentificador}`,
    html: emailHtml,
    text: `Estimado/a ${snapshot.sendclntenombre}, adjuntamos su proforma ${snapshot.sendprfmaidentificador}.`,
    attachments: [
      {
        filename: `${snapshot.sendprfmaidentificador}.pdf`,
        path: documentPath,
        contentType: 'application/pdf',
      },
    ],
  });
}

async function sendProformaWhatsapp(snapshot: SendProformaModel): Promise<void> {
  const whatsappApiInstance = await findSendProformaCompanyWhatsappApi(snapshot.sendemid);
  if (!whatsappApiInstance) {
    throw new Error('La instancia de API de WhatsApp no está configurada para esta empresa');
  }

  await sendProformaByWhatsapp(snapshot, whatsappApiInstance);
}

async function sendProforma(
  prfmaid: string,
  channel: string,
  user: LoginUserDto,
): Promise<void> {
  const validatedId = prfmaid.trim();
  if (validatedId.length === 0) {
    throw createErrorWithStatusCode(EMPTY_PROFORMA_ID_MESSAGE, BAD_REQUEST_STATUS_CODE);
  }

  if (channel !== 'email' && channel !== 'whatsapp') {
    throw createErrorWithStatusCode(INVALID_PROFORMA_SEND_CHANNEL_MESSAGE, BAD_REQUEST_STATUS_CODE);
  }

  await validateCompanyAndUserAccess(user, {});

  const proforma = await findProformaById({
    prfmaid: validatedId,
    prfmaemid: user.usemid,
  });
  if (!proforma) {
    throw createErrorWithStatusCode(INVALID_PROFORMA_NOT_FOUND_MESSAGE, 404);
  }

  if (proforma.prfmaestado === 'anulada') {
    throw createErrorWithStatusCode(INVALID_PROFORMA_STATUS_SEND_MESSAGE, BAD_REQUEST_STATUS_CODE);
  }

  if (channel === 'email') {
    const isEmailActive = await findSendProformaCompanyEmailActive(user.usemid);
    if (!isEmailActive) {
      throw createErrorWithStatusCode(
        INVALID_PROFORMA_CHANNEL_NOT_ACTIVE_MESSAGE,
        BAD_REQUEST_STATUS_CODE,
      );
    }

    const snapshot = buildProformaSnapshot(proforma);
    await sendProformaEmail(snapshot);
    return;
  }

  const isWhatsappActive = await findSendProformaCompanyWhatsappActive(user.usemid);
  if (!isWhatsappActive) {
    throw createErrorWithStatusCode(
      INVALID_PROFORMA_CHANNEL_NOT_ACTIVE_MESSAGE,
      BAD_REQUEST_STATUS_CODE,
    );
  }

  if (!env.whatsappApiconsultToken) {
    throw createErrorWithStatusCode(
      INVALID_PROFORMA_WHATSAPP_TOKEN_MESSAGE,
      BAD_REQUEST_STATUS_CODE,
    );
  }

  const snapshot = buildProformaSnapshot(proforma);
  await sendProformaWhatsapp(snapshot);
}

export {
  cancelProforma,
  createProforma,
  payProforma,
  readProforma,
  readProformaPdfDocument,
  readProformas,
  replaceProforma,
  sendProforma,
};
