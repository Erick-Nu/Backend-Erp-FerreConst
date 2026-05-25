import type { RequestHandler } from 'express';
import {
  getImage,
  saveImage,
  validateImageSize,
  validateImageType,
} from '../../middlewares/uploadImage.js';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateProductDto,
  FindProductDto,
  FindProductsParamsDto,
  UpdateProductDto,
} from './productDto.js';
import {
  createProduct,
  readProduct,
  readProducts,
  updateProduct,
} from './productService.js';

const PRODUCT_IMAGE_BASE_PATH = '/productos';
const DEFAULT_PRODUCT_IMAGE_PUBLIC_PATH = '/uploads/productos/product.png';

type CreateProductRequestBody = Omit<CreateProductDto, 'prdtoimagen'>;
type UpdateProductRequestBody = Omit<UpdateProductDto, 'prdtoid'>;

const registerProduct: RequestHandler = async (req, res, next) => {
  let imageDB: string;
  try {
    const image = getImage(req);
    if (!image) {
      imageDB = DEFAULT_PRODUCT_IMAGE_PUBLIC_PATH;
    } else {
      validateImageSize(image);
      validateImageType(image);
      imageDB = await saveImage(image, PRODUCT_IMAGE_BASE_PATH);
    }

    const body: CreateProductRequestBody = req.body;
    const {
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
    } = body;

    const product: CreateProductDto = {
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
      prdtoimagen: imageDB,
    };
    const user: LoginUserDto = req.auth!;

    const productDB = await createProduct(product, user);

    res.status(201).json(productDB);
  } catch (error) {
    next(error);
  }
};

const searchProducts: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindProductsParamsDto = {
      page,
      pageSize,
    };
    const user: LoginUserDto = req.auth!;
    const productsDB = await readProducts(params, user);

    res.status(200).json(productsDB);
  } catch (error) {
    next(error);
  }
};

const searchProduct: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Product id is required' });
      return;
    }

    const product: FindProductDto = {
      prdtoid: id,
    };
    const user: LoginUserDto = req.auth!;

    const productDB = await readProduct(product, user);
    if (!productDB) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.status(200).json(productDB);
  } catch (error) {
    next(error);
  }
};

const updateProductData: RequestHandler = async (req, res, next) => {
  let imageDB: string | undefined;
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Product id is required' });
      return;
    }

    const image = getImage(req);
    if (image) {
      validateImageSize(image);
      validateImageType(image);
      imageDB = await saveImage(image, PRODUCT_IMAGE_BASE_PATH);
    }

    const body: UpdateProductRequestBody = req.body;
    const {
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
      prdtoestado,
    } = body;
    const product: UpdateProductDto = {
      prdtoid: id,
    };

    if (prdtoctgriaid !== undefined) {
      product.prdtoctgriaid = prdtoctgriaid;
    }

    if (prdtomrcid !== undefined) {
      product.prdtomrcid = prdtomrcid;
    }

    if (prdtoprovid !== undefined) {
      product.prdtoprovid = prdtoprovid;
    }

    if (prdtomdiaid !== undefined) {
      product.prdtomdiaid = prdtomdiaid;
    }

    if (prdtocodigo !== undefined) {
      product.prdtocodigo = prdtocodigo;
    }

    if (prdtonombre !== undefined) {
      product.prdtonombre = prdtonombre;
    }

    if (prdtopreciocompra !== undefined) {
      product.prdtopreciocompra = prdtopreciocompra;
    }

    if (prdtoprecioventa !== undefined) {
      product.prdtoprecioventa = prdtoprecioventa;
    }

    if (prdtostockminimo !== undefined) {
      product.prdtostockminimo = prdtostockminimo;
    }

    if (prdtostockmaximo !== undefined) {
      product.prdtostockmaximo = prdtostockmaximo;
    }

    if (imageDB !== undefined) {
      product.prdtoimagen = imageDB;
    }

    if (prdtoestado !== undefined) {
      product.prdtoestado = prdtoestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedProduct = await updateProduct(product, user);
    if (!updatedProduct) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

export { registerProduct, searchProducts, searchProduct, updateProductData };
