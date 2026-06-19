import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateCheckoutDto,
  FindCheckoutDto,
  FindCheckoutsParamsDto,
  UpdateCheckoutDto,
} from './checkoutDto.js';
import { createCheckout, readCheckout, readCheckouts, updateCheckout } from './checkoutService.js';
import { isValidStatus } from '../../utils/validation.js';

type UpdateCheckoutRequestBody = Omit<UpdateCheckoutDto, 'cjid'>;

const registerCheckout: RequestHandler = async (req, res, next) => {
  try {
    const { cjemid, cjsuid, cjidentificador } = req.body;
    const checkout: CreateCheckoutDto = {
      cjemid,
      cjsuid,
      cjidentificador,
    };
    const user: LoginUserDto = req.auth!;

    const checkoutDB = await createCheckout(checkout, user);

    res.status(201).json(checkoutDB);
  } catch (error) {
    next(error);
  }
};

const searchCheckout: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cjsuid } = req.query;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Checkout id is required' });
      return;
    }

    if (typeof cjsuid !== 'string') {
      res.status(400).json({ message: 'Branch id is required' });
      return;
    }

    const checkout: FindCheckoutDto = {
      cjid: id,
      cjsuid,
    };
    const user: LoginUserDto = req.auth!;

    const checkoutDB = await readCheckout(checkout, user);
    if (!checkoutDB) {
      res.status(404).json({ message: 'Checkout not found' });
      return;
    }

    res.status(200).json(checkoutDB);
  } catch (error) {
    next(error);
  }
};

const searchCheckouts: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'Search must be a string' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'Status must be a string' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidStatus(statusQuery)) {
      res.status(400).json({ message: 'Status must be activo or inactivo' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindCheckoutsParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const user: LoginUserDto = req.auth!;
    const checkoutsDB = await readCheckouts(params, user);

    res.status(200).json(checkoutsDB);
  } catch (error) {
    next(error);
  }
};

const updateCheckoutStatus: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Checkout id is required' });
      return;
    }

    const body: UpdateCheckoutRequestBody = req.body;
    const { cjestado } = body;
    const checkout: UpdateCheckoutDto = {
      cjid: id,
      cjestado,
    };

    const user: LoginUserDto = req.auth!;
    const updatedCheckout = await updateCheckout(checkout, user);

    if (!updatedCheckout) {
      res.status(404).json({ message: 'Checkout not found' });
      return;
    }

    res.status(200).json(updatedCheckout);
  } catch (error) {
    next(error);
  }
};

export { registerCheckout, searchCheckout, searchCheckouts, updateCheckoutStatus };
