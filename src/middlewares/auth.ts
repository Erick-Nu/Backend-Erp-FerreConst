import type { RequestHandler } from 'express';
import {
  extractBearerToken,
  verifyAccessToken,
  type AuthTokenPayload,
} from '../utils/jwt.js';

const authenticate: RequestHandler = (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const decodedPayload = verifyAccessToken(token) as Partial<AuthTokenPayload>;
    const { usid, usemid, usrol } = decodedPayload;

    if (
      typeof usid !== 'string' ||
      typeof usemid !== 'string' ||
      (usrol !== 'administrador' && usrol !== 'jefe' && usrol !== 'empleado')
    ) {
      throw new Error('Invalid token payload');
    }

    req.auth = {
      usid,
      usemid,
      usrol,
    };

    next();
    
  } catch {
    const unauthorizedError = new Error('Unauthorized') as Error & {
      statusCode: number;
    };
    unauthorizedError.statusCode = 401;
    next(unauthorizedError);
  }
};

export { authenticate };
