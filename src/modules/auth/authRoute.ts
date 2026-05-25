import { Router } from 'express';

import { loginUser, logoutUser, refreshUserSession } from './authController.js';

const authRouter = Router();

authRouter.post('/login', loginUser);
authRouter.post('/refresh', refreshUserSession);
authRouter.post('/logout', logoutUser);

export { authRouter };
