import type { LoginUserDto } from '../auth/authDto.js';
import { findBrandById } from '../brand/brandDao.js';
import { findCategoryById } from '../category/categoryDao.js';
import { findCompanyById } from '../company/companyDao.js';
import { findMedidaById } from '../medida/medidaDao.js';
import { findProveedorById } from '../proveedor/proveedorDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import { toPublicImageUrl } from '../../middlewares/uploadImage.js';
import { validateNumber, validateRequiredString, validateStatus } from '../../utils/validation.js';
import type {
  CreateProductDto,
  FindProductDto,
  FindProductsParamsDto,
  FindProductsResponseDto,
  ProductResponseDto,
  UpdateProductDto,
} from './productDto.js';
import {
  findProductByCode,
  findProductById,
  findProductByName,
  findProducts,
  saveProduct,
  updateProductById,
} from './productDao.js';
import type { FindProductsResponseDao, ProductRowDao } from './productDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'Company id is required';
const EMPTY_PRODUCT_ID_MESSAGE = 'Product id is required';
const EMPTY_PRODUCT_CATEGORY_ID_MESSAGE = 'Product category id is required';
const EMPTY_PRODUCT_BRAND_ID_MESSAGE = 'Product brand id is required';
const EMPTY_PRODUCT_PROVEEDOR_ID_MESSAGE = 'Product proveedor id is required';
const EMPTY_PRODUCT_MEDIDA_ID_MESSAGE = 'Product medida id is required';
const EMPTY_PRODUCT_CODE_MESSAGE = 'Product code is required';
const EMPTY_PRODUCT_NAME_MESSAGE = 'Product name is required';
const EMPTY_PRODUCT_IMAGE_MESSAGE = 'Product image is required';
const EMPTY_PRODUCT_STATUS_MESSAGE = 'Product status is required';
const INVALID_PRODUCT_UPDATE_STATUS_MESSAGE = 'Product status must be activo, inactivo or eliminado';
const INVALID_COMPANY_FIND_MESSAGE = 'Company does not exist';
const INVALID_COMPANY_STATUS_MESSAGE = 'Company is not active';
const INVALID_USER_NOT_FOUND_MESSAGE = 'User does not exist';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'User does not belong to the company';
const INVALID_USER_STATUS_MESSAGE = 'User is not active';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'User is not admin';
const FORBIDDEN_ROL_USER_MESSAGE = 'User is not jefe, empleado or admin';
const FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE = 'User is not jefe or empleado';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'Company is not parent';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'User cannot access another company';
const INVALID_PAGE_MESSAGE = 'Page must be a positive integer';
const INVALID_PAGE_SIZE_MESSAGE = 'Page size must be a positive integer';
const INVALID_PRODUCT_CODE_EXISTS_MESSAGE = 'Product already exists with that code';
const INVALID_PRODUCT_NAME_EXISTS_MESSAGE = 'Product already exists with that name';
const INVALID_PRODUCT_CATEGORY_NOT_FOUND_MESSAGE = 'Product category does not exist';
const INVALID_PRODUCT_BRAND_NOT_FOUND_MESSAGE = 'Product brand does not exist';
const INVALID_PRODUCT_PROVEEDOR_NOT_FOUND_MESSAGE = 'Product proveedor does not exist';
const INVALID_PRODUCT_MEDIDA_NOT_FOUND_MESSAGE = 'Product medida does not exist';
const EMPTY_UPDATE_PRODUCT_MESSAGE = 'At least one field is required to update product';
const FORBIDDEN_UPDATE_DELETED_PRODUCT_MESSAGE = 'Deleted product cannot be updated';

type AccessOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

type RelatedEntitiesInput = {
  prdtoctgriaid?: string;
  prdtomrcid?: string;
  prdtoprovid?: string;
  prdtomdiaid?: string;
};

function mapProductRowToResponse(product: ProductRowDao): ProductResponseDto {
  return {
    prdtoid: product.prdtoid,
    prdtoemid: product.prdtoemid,
    categoria: {
      ctgriaid: product.prdtoctgriaid,
      ctgnombre: product.ctgnombre ?? null,
      ctgriadescripcion: product.ctgriadescripcion ?? null,
    },
    marca: {
      mrcid: product.prdtomrcid,
      mrcnombre: product.mrcnombre ?? null,
    },
    proveedor: {
      provid: product.prdtoprovid,
      provnombre: product.provnombre ?? null,
    },
    medida: {
      mdiaid: product.prdtomdiaid,
      mdianombre: product.mdianombre ?? null,
      mdiaabreviatura: product.mdiaabreviatura ?? null,
    },
    prdtocodigo: product.prdtocodigo,
    prdtonombre: product.prdtonombre,
    prdtopreciocompra: product.prdtopreciocompra,
    prdtoprecioventa: product.prdtoprecioventa,
    prdtostockminimo: product.prdtostockminimo,
    prdtostockmaximo: product.prdtostockmaximo,
    prdtoimagen: product.prdtoimagen ? toPublicImageUrl(product.prdtoimagen) : null,
    prdtofchregistro: product.prdtofchregistro,
    prdtoestado: product.prdtoestado,
  };
}

function mapFindProductsResponse(productsDB: FindProductsResponseDao): FindProductsResponseDto {
  return {
    ...productsDB,
    items: productsDB.items.map(mapProductRowToResponse),
  };
}

function validateFindProductsParams(params: FindProductsParamsDto): FindProductsParamsDto {
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

  const validatedParams: FindProductsParamsDto = {
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

async function validateRequesterJefeOrEmpleado(user: LoginUserDto): Promise<void> {
  const requesterUser = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!requesterUser) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  if (!['jefe', 'empleado'].includes(requesterUser.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_JEFE_OR_EMPLEADO_MESSAGE);
  }
}

async function validateRelatedEntities(
  companyId: string,
  input: RelatedEntitiesInput,
): Promise<void> {
  if (input.prdtoctgriaid !== undefined) {
    const categoryDB = await findCategoryById({
      ctgriaemid: companyId,
      ctgriaid: input.prdtoctgriaid,
    });

    if (!categoryDB) {
      throw new Error(INVALID_PRODUCT_CATEGORY_NOT_FOUND_MESSAGE);
    }
  }

  if (input.prdtomrcid !== undefined) {
    const brandDB = await findBrandById({
      mrcemid: companyId,
      mrcid: input.prdtomrcid,
    });

    if (!brandDB) {
      throw new Error(INVALID_PRODUCT_BRAND_NOT_FOUND_MESSAGE);
    }
  }

  if (input.prdtoprovid !== undefined) {
    const proveedorDB = await findProveedorById({
      provemid: companyId,
      provid: input.prdtoprovid,
    });

    if (!proveedorDB) {
      throw new Error(INVALID_PRODUCT_PROVEEDOR_NOT_FOUND_MESSAGE);
    }
  }

  if (input.prdtomdiaid !== undefined) {
    const medidaDB = await findMedidaById({
      mdiaemid: companyId,
      mdiaid: input.prdtomdiaid,
    });

    if (!medidaDB) {
      throw new Error(INVALID_PRODUCT_MEDIDA_NOT_FOUND_MESSAGE);
    }
  }
}

async function createProduct(product: CreateProductDto, user: LoginUserDto): Promise<ProductResponseDto> {
  const prdtoemid = validateRequiredString(product.prdtoemid, EMPTY_COMPANY_ID_MESSAGE);
  const prdtoctgriaid = validateRequiredString(product.prdtoctgriaid, EMPTY_PRODUCT_CATEGORY_ID_MESSAGE);
  const prdtomrcid = validateRequiredString(product.prdtomrcid, EMPTY_PRODUCT_BRAND_ID_MESSAGE);
  const prdtoprovid = validateRequiredString(product.prdtoprovid, EMPTY_PRODUCT_PROVEEDOR_ID_MESSAGE);
  const prdtomdiaid = validateRequiredString(product.prdtomdiaid, EMPTY_PRODUCT_MEDIDA_ID_MESSAGE);
  const prdtocodigo = validateRequiredString(product.prdtocodigo, EMPTY_PRODUCT_CODE_MESSAGE);
  const prdtonombre = validateRequiredString(product.prdtonombre, EMPTY_PRODUCT_NAME_MESSAGE);
  const prdtopreciocompra = validateNumber(product.prdtopreciocompra);
  const prdtoprecioventa = validateNumber(product.prdtoprecioventa);
  const prdtostockminimo = validateNumber(product.prdtostockminimo);
  const prdtostockmaximo = validateNumber(product.prdtostockmaximo);
  const prdtoimagen = product.prdtoimagen === null
    ? null
    : (product.prdtoimagen !== undefined
      ? validateRequiredString(product.prdtoimagen, EMPTY_PRODUCT_IMAGE_MESSAGE)
      : null);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: prdtoemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);
    await validateRelatedEntities(prdtoemid, {
      prdtoctgriaid,
      prdtomrcid,
      prdtoprovid,
      prdtomdiaid,
    });

    const productByCodeDB = await findProductByCode({
      prdtoemid,
      prdtocodigo,
    });

    if (productByCodeDB) {
      throw new Error(INVALID_PRODUCT_CODE_EXISTS_MESSAGE);
    }

    const productByNameDB = await findProductByName({
      prdtoemid,
      prdtonombre,
    });

    if (productByNameDB) {
      throw new Error(INVALID_PRODUCT_NAME_EXISTS_MESSAGE);
    }

    const productId = await saveProduct({
      prdtoemid,
      prdtoctgriaid,
      prdtomrcid,
      prdtoprovid,
      prdtomdiaid,
      prdtocodigo,
      prdtonombre,
      prdtopreciocompra,
      prdtoprecioventa,
      prdtostockminimo,
      prdtostockmaximo,
      prdtoimagen,
    });

    const newProduct = await findProductById({
      prdtoemid,
      prdtoid: productId,
    });

    if (!newProduct) {
      throw new Error('Product was not created');
    }

    return mapProductRowToResponse(newProduct);
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: prdtoemid,
        productCode: prdtocodigo,
        productName: prdtonombre,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error creating product',
    );
    throw error;
  }
}

async function readProduct(product: FindProductDto, user: LoginUserDto): Promise<ProductResponseDto | null> {
  const prdtoid = validateRequiredString(product.prdtoid, EMPTY_PRODUCT_ID_MESSAGE);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const productDB = await findProductById({
      prdtoemid: user.usemid,
      prdtoid,
    });

    if (!productDB) {
      throw new Error('Product not found');
    }

    return mapProductRowToResponse(productDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        productId: prdtoid,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading product',
    );
    throw error;
  }
}

async function readProducts(
  params: FindProductsParamsDto,
  user: LoginUserDto,
): Promise<FindProductsResponseDto> {
  const validatedParams = validateFindProductsParams(params);

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const productsDB = await findProducts(validatedParams, user.usemid);

    return mapFindProductsResponse(productsDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        search: validatedParams.search,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error reading products',
    );
    throw error;
  }
}

async function updateProduct(product: UpdateProductDto, user: LoginUserDto): Promise<ProductResponseDto | null> {
  const prdtoid = validateRequiredString(product.prdtoid, EMPTY_PRODUCT_ID_MESSAGE);
  const prdtoctgriaid = product.prdtoctgriaid !== undefined
    ? validateRequiredString(product.prdtoctgriaid, EMPTY_PRODUCT_CATEGORY_ID_MESSAGE)
    : undefined;
  const prdtomrcid = product.prdtomrcid !== undefined
    ? validateRequiredString(product.prdtomrcid, EMPTY_PRODUCT_BRAND_ID_MESSAGE)
    : undefined;
  const prdtoprovid = product.prdtoprovid !== undefined
    ? validateRequiredString(product.prdtoprovid, EMPTY_PRODUCT_PROVEEDOR_ID_MESSAGE)
    : undefined;
  const prdtomdiaid = product.prdtomdiaid !== undefined
    ? validateRequiredString(product.prdtomdiaid, EMPTY_PRODUCT_MEDIDA_ID_MESSAGE)
    : undefined;
  const prdtocodigo = product.prdtocodigo !== undefined
    ? validateRequiredString(product.prdtocodigo, EMPTY_PRODUCT_CODE_MESSAGE)
    : undefined;
  const prdtonombre = product.prdtonombre !== undefined
    ? validateRequiredString(product.prdtonombre, EMPTY_PRODUCT_NAME_MESSAGE)
    : undefined;
  const prdtopreciocompra = product.prdtopreciocompra !== undefined
    ? validateNumber(product.prdtopreciocompra)
    : undefined;
  const prdtoprecioventa = product.prdtoprecioventa !== undefined
    ? validateNumber(product.prdtoprecioventa)
    : undefined;
  const prdtostockminimo = product.prdtostockminimo !== undefined
    ? validateNumber(product.prdtostockminimo)
    : undefined;
  const prdtostockmaximo = product.prdtostockmaximo !== undefined
    ? validateNumber(product.prdtostockmaximo)
    : undefined;
  const prdtoimagen = product.prdtoimagen !== undefined
    ? (product.prdtoimagen === null
      ? null
      : validateRequiredString(product.prdtoimagen, EMPTY_PRODUCT_IMAGE_MESSAGE))
    : undefined;
  const prdtoestado = product.prdtoestado !== undefined
    ? validateStatus(product.prdtoestado, EMPTY_PRODUCT_STATUS_MESSAGE, INVALID_PRODUCT_UPDATE_STATUS_MESSAGE)
    : undefined;

  try {
    const access = {
      requireParentCompany: false,
      requireAdminUser: false,
      targetCompanyId: user.usemid,
    };

    await validateCompanyAndUserAccess(user, access);
    await validateRequesterJefeOrEmpleado(user);

    const productDB = await findProductById({
      prdtoemid: user.usemid,
      prdtoid,
    });

    if (!productDB) {
      return null;
    }

    if (productDB.prdtoestado === 'eliminado') {
      throw new Error(FORBIDDEN_UPDATE_DELETED_PRODUCT_MESSAGE);
    }

    if (prdtocodigo !== undefined) {
      const productByCodeDB = await findProductByCode({
        prdtoemid: user.usemid,
        prdtocodigo,
      });

      if (productByCodeDB && productByCodeDB.prdtoid !== prdtoid) {
        throw new Error(INVALID_PRODUCT_CODE_EXISTS_MESSAGE);
      }
    }

    if (prdtonombre !== undefined) {
      const productByNameDB = await findProductByName({
        prdtoemid: user.usemid,
        prdtonombre,
      });

      if (productByNameDB && productByNameDB.prdtoid !== prdtoid) {
        throw new Error(INVALID_PRODUCT_NAME_EXISTS_MESSAGE);
      }
    }

    const relatedEntitiesToValidate: RelatedEntitiesInput = {};
    if (prdtoctgriaid !== undefined) {
      relatedEntitiesToValidate.prdtoctgriaid = prdtoctgriaid;
    }
    if (prdtomrcid !== undefined) {
      relatedEntitiesToValidate.prdtomrcid = prdtomrcid;
    }
    if (prdtoprovid !== undefined) {
      relatedEntitiesToValidate.prdtoprovid = prdtoprovid;
    }
    if (prdtomdiaid !== undefined) {
      relatedEntitiesToValidate.prdtomdiaid = prdtomdiaid;
    }

    await validateRelatedEntities(user.usemid, relatedEntitiesToValidate);

    const dataDB: {
      column: string;
      value: string | number | boolean | Date | null;
    }[] = [];

    if (prdtoctgriaid !== undefined && prdtoctgriaid !== productDB.prdtoctgriaid) {
      dataDB.push({ column: 'prdtoctgriaid', value: prdtoctgriaid });
    }

    if (prdtomrcid !== undefined && prdtomrcid !== productDB.prdtomrcid) {
      dataDB.push({ column: 'prdtomrcid', value: prdtomrcid });
    }

    if (prdtoprovid !== undefined && prdtoprovid !== productDB.prdtoprovid) {
      dataDB.push({ column: 'prdtoprovid', value: prdtoprovid });
    }

    if (prdtomdiaid !== undefined && prdtomdiaid !== productDB.prdtomdiaid) {
      dataDB.push({ column: 'prdtomdiaid', value: prdtomdiaid });
    }

    if (prdtocodigo !== undefined && prdtocodigo !== productDB.prdtocodigo) {
      dataDB.push({ column: 'prdtocodigo', value: prdtocodigo });
    }

    if (prdtonombre !== undefined && prdtonombre !== productDB.prdtonombre) {
      dataDB.push({ column: 'prdtonombre', value: prdtonombre });
    }

    if (prdtopreciocompra !== undefined && prdtopreciocompra !== productDB.prdtopreciocompra) {
      dataDB.push({ column: 'prdtopreciocompra', value: prdtopreciocompra });
    }

    if (prdtoprecioventa !== undefined && prdtoprecioventa !== productDB.prdtoprecioventa) {
      dataDB.push({ column: 'prdtoprecioventa', value: prdtoprecioventa });
    }

    if (prdtostockminimo !== undefined && prdtostockminimo !== productDB.prdtostockminimo) {
      dataDB.push({ column: 'prdtostockminimo', value: prdtostockminimo });
    }

    if (prdtostockmaximo !== undefined && prdtostockmaximo !== productDB.prdtostockmaximo) {
      dataDB.push({ column: 'prdtostockmaximo', value: prdtostockmaximo });
    }

    if (prdtoimagen !== undefined && prdtoimagen !== productDB.prdtoimagen) {
      dataDB.push({ column: 'prdtoimagen', value: prdtoimagen });
    }

    if (prdtoestado !== undefined && prdtoestado !== productDB.prdtoestado) {
      dataDB.push({ column: 'prdtoestado', value: prdtoestado });
    }

    if (dataDB.length === 0) {
      throw new Error(EMPTY_UPDATE_PRODUCT_MESSAGE);
    }

    const updatedProductDB = await updateProductById(dataDB, {
      prdtoemid: user.usemid,
      prdtoid,
    });

    if (!updatedProductDB) {
      return null;
    }

    const refreshedProductDB = await findProductById({
      prdtoemid: user.usemid,
      prdtoid: updatedProductDB.prdtoid,
    });

    if (!refreshedProductDB) {
      throw new Error('Product not found');
    }

    return mapProductRowToResponse(refreshedProductDB);
  } catch (error) {
    logger.error(
      {
        err: error,
        productId: prdtoid,
        hasCategory: prdtoctgriaid !== undefined,
        hasBrand: prdtomrcid !== undefined,
        hasProveedor: prdtoprovid !== undefined,
        hasMedida: prdtomdiaid !== undefined,
        hasCode: prdtocodigo !== undefined,
        hasName: prdtonombre !== undefined,
        hasPurchasePrice: prdtopreciocompra !== undefined,
        hasSalePrice: prdtoprecioventa !== undefined,
        hasMinStock: prdtostockminimo !== undefined,
        hasMaxStock: prdtostockmaximo !== undefined,
        hasImage: prdtoimagen !== undefined,
        hasStatus: prdtoestado !== undefined,
        requesterUserId: user.usid,
        requesterCompanyId: user.usemid,
      },
      'Error updating product',
    );
    throw error;
  }
}

export { createProduct, readProduct, readProducts, updateProduct };
