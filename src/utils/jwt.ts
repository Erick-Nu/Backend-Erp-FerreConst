import type { Role } from '../config/databaseTypes.js';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

type AuthTokenPayload = {
  usid: string;
  usemid: string;
  usrol: Role;
};

const INVALID_TOKEN_MESSAGE = 'Invalid or expired token';
const MISSING_AUTH_HEADER_MESSAGE = 'Authorization header is required';
const INVALID_AUTH_HEADER_MESSAGE = 'Authorization header must use Bearer token';

function signAccessToken(payload: AuthTokenPayload): string {
  const expiresIn = env.jwtExpiresIn;
  const secretKey = env.jwtSecret;
  const options: SignOptions = { expiresIn };
  const token = jwt.sign(payload, secretKey, options);
  return token;
}

function verifyAccessToken(token: string): JwtPayload {
  const secretKey = env.jwtSecret;
  try {
    const payload = jwt.verify(token, secretKey);

    if (typeof payload === 'string') {
      throw new Error(INVALID_TOKEN_MESSAGE);
    }

    return payload;
  } catch {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }
}

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new Error(MISSING_AUTH_HEADER_MESSAGE);
  }

  const [scheme, token] = authorizationHeader.trim().split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new Error(INVALID_AUTH_HEADER_MESSAGE);
  }

  return token;
}

export { extractBearerToken, signAccessToken, verifyAccessToken };
export type { AuthTokenPayload };
