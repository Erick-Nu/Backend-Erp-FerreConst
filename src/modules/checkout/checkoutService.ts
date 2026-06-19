import type { LoginUserDto } from '../auth/authDto.js';
import { findBranchById } from '../branch/branchDao.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import { validateBranchIdentifier, validateRequiredString, validateStatus } from '../../utils/validation.js';
import type {
  CheckoutDetailResponseDto,
  CheckoutListItemResponseDto,
  CheckoutResponseDto,
  CreateCheckoutDto,
  FindCheckoutDto,
  FindCheckoutsParamsDto,
  FindCheckoutsResponseDto,
  UpdateCheckoutDto,
} from './checkoutDto.js';
import {
  findCheckoutById,
  findCheckoutByRowId,
  findCheckouts,
  saveCheckout,
  updateCheckoutStatusById,
} from './checkoutDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_BRANCH_ID_MESSAGE = 'El id de sucursal es requerido';
const EMPTY_CHECKOUT_ID_MESSAGE = 'El identificador de caja es requerido';
const EMPTY_CHECKOUT_IDENTIFIER_MESSAGE = 'El identificador de caja es requerido';
const EMPTY_CHECKOUT_STATUS_MESSAGE = 'El estado de caja es requerido';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no esta activo';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe, empleado o administrador';
const FORBIDDEN_ROL_USER_JEFE_MESSAGE = 'El usuario no es jefe';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es empresa padre';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const INVALID_BRANCH_FIND_MESSAGE = 'La sucursal no existe';
const INVALID_BRANCH_STATUS_MESSAGE = 'La sucursal no esta activa';
const INVALID_CHECKOUT_IDENTIFIER_EXISTS_MESSAGE = 'Ya existe una caja con ese identificador en esta sucursal';
const INVALID_CHECKOUT_UPDATE_STATUS_MESSAGE = 'El estado de caja debe ser activo, inactivo o eliminado';
const INVALID_PAGE_MESSAGE = 'La pagina debe ser un entero positivo';
const INVALID_PAGE_SIZE_MESSAGE = 'El tamaño de pagina debe ser un entero positivo';
const FORBIDDEN_UPDATE_DELETED_CHECKOUT_MESSAGE = 'La caja eliminada no puede ser actualizada';
const CONFLICT_STATUS_CODE = 409;

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

type ErrorWithStatusCode = Error & {
  statusCode: number;
};

function createErrorWithStatusCode(message: string, statusCode: number): ErrorWithStatusCode {
  const error = new Error(message) as ErrorWithStatusCode;
  error.statusCode = statusCode;

  return error;
}

function validateFindCheckoutsParams(params: FindCheckoutsParamsDto): FindCheckoutsParamsDto {
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

  const validatedParams: FindCheckoutsParamsDto = {
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

type CheckoutWithBranchShape = CheckoutResponseDto & {
  suid: string;
  sunombre: string;
  suidentificador: string;
  suestado: CheckoutDetailResponseDto['sucursal']['suestado'];
};

function mapCheckoutWithBranchToDetailResponse(checkout: CheckoutWithBranchShape): CheckoutDetailResponseDto {
  return {
    cjid: checkout.cjid,
    cjemid: checkout.cjemid,
    cjsuid: checkout.cjsuid,
    cjidentificador: checkout.cjidentificador,
    cjfchregistro: checkout.cjfchregistro,
    cjestado: checkout.cjestado,
    sucursal: {
      suid: checkout.suid,
      sunombre: checkout.sunombre,
      suidentificador: checkout.suidentificador,
      suestado: checkout.suestado,
    },
  };
}

async function validateCompanyAndUserAccess(user: LoginUserDto, options: AccessOptions): Promise<void> {
  const { requireParentCompany, requireAdminUser, targetCompanyId } = options;

  const companyDB = await findCompanyById(user.usemid);
  if (!companyDB) {
    throw new Error(INVALID_COMPANY_FIND_MESSAGE);
  }

  const isActiveCompany = companyDB.emestado;
  if (isActiveCompany !== 'activo') {
    throw new Error(INVALID_COMPANY_STATUS_MESSAGE);
  }

  const userDB = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });
  
  if (!userDB) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  const isUserCompany = userDB.usemid;
  if (isUserCompany !== user.usemid) {
    throw new Error(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE);
  }

  if (targetCompanyId && targetCompanyId !== user.usemid) {
    throw new Error(FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE);
  }

  if (requireAdminUser && userDB.usrol !== 'administrador') {
    throw new Error(FORBIDDEN_ROL_USER_ADMIN_MESSAGE);
  }

  if (!requireAdminUser && !['jefe', 'empleado', 'administrador'].includes(userDB.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_MESSAGE);
  }

  const isActiveUser = userDB.usestado;
  if (isActiveUser !== 'activo') {
    throw new Error(INVALID_USER_STATUS_MESSAGE);
  }

  if (requireParentCompany && !companyDB.empadre) {
    throw new Error(FORBIDDEN_COMPANY_CREATION_MESSAGE);
  }
}

async function createCheckout(checkout: CreateCheckoutDto, user: LoginUserDto): Promise<CheckoutResponseDto> {
  const cjemid = validateRequiredString(checkout.cjemid, EMPTY_COMPANY_ID_MESSAGE);
  const cjsuid = validateRequiredString(checkout.cjsuid, EMPTY_BRANCH_ID_MESSAGE);
  const cjidentificador = validateBranchIdentifier(checkout.cjidentificador, EMPTY_CHECKOUT_IDENTIFIER_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: cjemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const requesterUser = await findUserById({
      usid: user.usid,
      usemid: user.usemid,
    });

    if (!requesterUser) {
      throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
    }

    if (requesterUser.usrol !== 'jefe') {
      throw new Error(FORBIDDEN_ROL_USER_JEFE_MESSAGE);
    }

    const branchDB = await findBranchById({
      suemid: cjemid,
      suid: cjsuid,
    });

    if (!branchDB) {
      throw new Error(INVALID_BRANCH_FIND_MESSAGE);
    }

    if (branchDB.suestado !== 'activo') {
      throw new Error(INVALID_BRANCH_STATUS_MESSAGE);
    }

    const checkoutIdentifierDB = await findCheckoutById({
      cjemid,
      cjsuid,
      cjidentificador,
    });

    if (checkoutIdentifierDB) {
      throw createErrorWithStatusCode(
        INVALID_CHECKOUT_IDENTIFIER_EXISTS_MESSAGE,
        CONFLICT_STATUS_CODE,
      );
    }

    const checkoutId = await saveCheckout({
      cjemid,
      cjsuid,
      cjidentificador,
    });

    
    const newCheckout = await findCheckoutByRowId({
      cjid: checkoutId,
      cjemid,
    });

    return newCheckout!;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: cjemid,
        branchId: cjsuid,
        identifier: cjidentificador,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating checkout',
    );
    throw error;
  }
}

async function readCheckout(checkout: FindCheckoutDto, user: LoginUserDto): Promise<CheckoutDetailResponseDto | null> {
  const cjid = validateRequiredString(checkout.cjid, EMPTY_CHECKOUT_ID_MESSAGE);
  const cjsuid = validateRequiredString(checkout.cjsuid, EMPTY_BRANCH_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const checkoutDB = await findCheckoutById({
      cjemid: user.usemid,
      cjsuid,
      cjidentificador: cjid,
    });
    if (!checkoutDB) {
      throw new Error('Caja no encontrada');
    }

    return mapCheckoutWithBranchToDetailResponse(checkoutDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        checkoutId: cjid,
        branchId: cjsuid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading checkout',
    );
    throw error;
  }
}

async function readCheckouts(
  params: FindCheckoutsParamsDto,
  user: LoginUserDto,
): Promise<FindCheckoutsResponseDto> {
  const validatedParams = validateFindCheckoutsParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const checkoutsDB = await findCheckouts(validatedParams, user.usemid);
    const itemsWithBranch: CheckoutListItemResponseDto[] = checkoutsDB.items.map((checkout) => ({
      cjid: checkout.cjid,
      cjemid: checkout.cjemid,
      cjsuid: checkout.cjsuid,
      cjidentificador: checkout.cjidentificador,
      cjfchregistro: checkout.cjfchregistro,
      cjestado: checkout.cjestado,
      sucursal: {
        suid: checkout.suid,
        sunombre: checkout.sunombre,
        suidentificador: checkout.suidentificador,
        suestado: checkout.suestado,
      },
    }));

    return {
      ...checkoutsDB,
      items: itemsWithBranch,
    };
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading checkouts',
    );
    throw error;
  }
}

async function updateCheckout(checkout: UpdateCheckoutDto, user: LoginUserDto): Promise<CheckoutDetailResponseDto | null> {
  const cjid = validateRequiredString(checkout.cjid, EMPTY_CHECKOUT_ID_MESSAGE);
  const cjestado = validateStatus(
    checkout.cjestado,
    EMPTY_CHECKOUT_STATUS_MESSAGE,
    INVALID_CHECKOUT_UPDATE_STATUS_MESSAGE,
  );

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);

    const requesterUser = await findUserById({
      usid: user.usid,
      usemid: user.usemid,
    });

    if (!requesterUser) {
      throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
    }

    if (requesterUser.usrol !== 'jefe') {
      throw new Error(FORBIDDEN_ROL_USER_JEFE_MESSAGE);
    }

    const checkoutDB = await findCheckoutByRowId({
      cjid,
      cjemid: user.usemid,
    });

    if (!checkoutDB) {
      return null;
    }

    if (checkoutDB.cjestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_CHECKOUT_MESSAGE);
    }

    const updatedCheckoutDB = await updateCheckoutStatusById(cjestado, {
      cjid,
      cjemid: user.usemid,
    });

    if (!updatedCheckoutDB) {
      return null;
    }

    return mapCheckoutWithBranchToDetailResponse(updatedCheckoutDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        checkoutId: cjid,
        status: cjestado,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating checkout',
    );
    throw error;
  }
}

export { createCheckout, readCheckout, readCheckouts, updateCheckout, validateCompanyAndUserAccess };
