import type { RequestHandler } from 'express';
import type { LoginDto, RefreshTokenDto } from './authDto.js';
import { login, logout, refreshSession } from './authService.js';

type LoginRequestBody = LoginDto;
type RefreshTokenRequestBody = RefreshTokenDto;

function getRequestUserAgent(userAgentHeader: string | string[] | undefined): string | null {
  if (typeof userAgentHeader === 'string') {
    return userAgentHeader;
  }

  if (Array.isArray(userAgentHeader) && userAgentHeader.length > 0) {
    return userAgentHeader[0] ?? null;
  }

  return null;
}

const loginUser: RequestHandler = async (req, res, next) => {
  try {
    const body: LoginRequestBody = req.body;
    const { emruc, usapodo, uspassword } = body;
    const credentials: LoginDto = {
      emruc,
      usapodo,
      uspassword,
    };
    const metadata = {
      ip: req.ip ?? null,
      userAgent: getRequestUserAgent(req.headers['user-agent']),
    };

    const authResponse = await login(credentials, metadata);

    if (!authResponse) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    res.status(200).json(authResponse);

  } catch (error) {
    next(error);
  }
};

const refreshUserSession: RequestHandler = async (req, res, next) => {
  try {
    const body: RefreshTokenRequestBody = req.body;
    const { refreshToken } = body;

    const refreshData: RefreshTokenDto = {
      refreshToken,
    };
    const metadata = {
      ip: req.ip ?? null,
      userAgent: getRequestUserAgent(req.headers['user-agent']),
    };

    const tokens = await refreshSession(refreshData, metadata);
    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
};

const logoutUser: RequestHandler = async (req, res, next) => {
  try {
    const body: RefreshTokenRequestBody = req.body;
    const { refreshToken } = body;

    const refreshData: RefreshTokenDto = {
      refreshToken,
    };

    await logout(refreshData);

    res.status(200).json({
      message: 'Session closed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export { loginUser, logoutUser, refreshUserSession };
