import type { RequestHandler } from 'express';
import type { LoginDto } from './authDto.js';
import { login } from './authService.js';

type LoginRequestBody = LoginDto;

const loginUser: RequestHandler = async (req, res, next) => {
  try {
    const body: LoginRequestBody = req.body;
    const { emruc, usapodo, uspassword } = body;
    const credentials: LoginDto = {
      emruc,
      usapodo,
      uspassword,
    };

    const authResponse = await login(credentials);

    if (!authResponse) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    res.status(200).json(authResponse);

  } catch (error) {
    next(error);
  }
};

const logoutUser: RequestHandler = (req, res) => {
  res.status(200).json({
    message: 'Session closed successfully',
  });
};

export { loginUser, logoutUser };
