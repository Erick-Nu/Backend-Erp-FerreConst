import { Router } from 'express';
import { parseImage } from '../../middlewares/uploadImage.js';
import { authenticate } from '../../middlewares/auth.js';
import {
  registerUser,
  searchUser,
  searchUsers,
  updateUserData,
  updateUserPasswordData,
  updateUserStatus,
} from './userController.js';

const userRouter = Router();

userRouter.post('/', parseImage, authenticate, registerUser);
userRouter.get('/', authenticate, searchUsers);
userRouter.get('/:id', authenticate, searchUser);
userRouter.patch('/:id', authenticate, parseImage, updateUserData);
userRouter.patch('/:id/password', authenticate, updateUserPasswordData);
userRouter.patch('/:id/status', authenticate, updateUserStatus);

export { userRouter };
