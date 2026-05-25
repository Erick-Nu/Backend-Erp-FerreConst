import type { RequestHandler } from 'express';
import {
  getImage,
  saveImage,
  validateImageSize,
  validateImageType,
} from '../../middlewares/uploadImage.js';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateUserDto,
  FindUserDto,
  FindUsersParamsDto,
  UpdateStatusUserDto,
  UpdateUserDto,
} from './userDto.js';
import { createUser, readUser, readUsers, updateUser, updateUserWithStatus } from './userService.js';

const USER_IMAGE_BASE_PATH = '/usuarios';
const DEFAULT_USER_IMAGE_PUBLIC_PATH = '/uploads/usuarios/user.png';

type CreateUserRequestBody = Omit<CreateUserDto, 'usimagen'>;

type UpdateUserRequestBody = Omit<UpdateUserDto, 'usid' | 'usimagen'>;


const registerUser: RequestHandler = async (req, res, next) => {
  let imagenDB: string;
  try {
    const image = getImage(req);
    if (!image) {
      imagenDB = DEFAULT_USER_IMAGE_PUBLIC_PATH;
    } else {
      validateImageSize(image);
      validateImageType(image);
      imagenDB = await saveImage(image, USER_IMAGE_BASE_PATH);
    }
    const body: CreateUserRequestBody = req.body;
    const { usemid, usnombre, usapodo, uscorreo, uspassword, usrol } = body;
    const user: CreateUserDto = {
      usemid,
      usnombre,
      usapodo,
      uscorreo,
      uspassword,
      usimagen: imagenDB,
      usrol,
    }
    const userLogin = req.auth!;

    const userDB = await createUser(user, userLogin);

    res.status(201).json(userDB);
  } catch (error) {
    next(error);
  }
};

const searchUsers: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindUsersParamsDto = {
      page,
      pageSize,
    };
    const user: LoginUserDto = req.auth!;
    const usersDB = await readUsers(params, user);

    res.status(200).json(usersDB);
  } catch (error) {
    next(error);
  }
};

const searchUser: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'User id is required' });
      return;
    }

    const user: LoginUserDto = req.auth!;
    const userData: FindUserDto = {
      usid: id,
    };
    const userDB = await readUser(userData, user);

    if (!userDB) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json(userDB);
  } catch (error) {
    next(error);
  }
};

const updateUserStatus: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { usestado } = req.body;

    if (typeof id !== 'string') {
      res.status(400).json({ message: 'User id is required' });
      return;
    }

    const userData: UpdateStatusUserDto = {
      usid: id,
      usestado,
    };

    const user: LoginUserDto = req.auth!;
    const updated = await updateUserWithStatus(userData, user);

    if (!updated) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ message: 'User status updated' });
  } catch (error) {
    next(error);
  }
};

const updateUserData: RequestHandler = async (req, res, next) => {
  let imagenDB: string | undefined;
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'User id is required' });
      return;
    }

    const image = getImage(req);
    if (image) {
      validateImageSize(image);
      validateImageType(image);
      imagenDB = await saveImage(image, USER_IMAGE_BASE_PATH);
    }

    const body: UpdateUserRequestBody = req.body;
    const { usnombre, uscorreo, usestado, usrol } = body;
    const userData: UpdateUserDto = { usid: id };

    if (usnombre !== undefined) {
      userData.usnombre = usnombre;
    }

    if (uscorreo !== undefined) {
      userData.uscorreo = uscorreo;
    }

    if (usestado !== undefined) {
      userData.usestado = usestado;
    }

    if (usrol !== undefined) {
      userData.usrol = usrol;
    }

    if (imagenDB !== undefined) {
      userData.usimagen = imagenDB;
    }

    const user: LoginUserDto = req.auth!;
    const updatedUser = await updateUser(userData, user);

    if (!updatedUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export { registerUser, searchUsers, searchUser, updateUserStatus, updateUserData };
