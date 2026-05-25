import { Router } from 'express';

import { loginUser, logoutUser } from './authController.js';

const authRouter = Router();

authRouter.post('/login', loginUser);
authRouter.post('/logout', logoutUser);

export { authRouter };
