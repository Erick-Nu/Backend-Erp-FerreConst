import bcrypt from 'bcrypt';

import { env } from '../config/env.js';

const EMPTY_PASSWORD_MESSAGE = 'La contrasena es requerida';
const EMPTY_HASH_MESSAGE = 'El hash de contrasena es requerido';

function validatePassword(password: string): void {
  if (password.length > 0) {
    return;
  }

  throw new Error(EMPTY_PASSWORD_MESSAGE);
}

function validatePasswordHash(passwordHash: string): void {
  if (passwordHash.length > 0) {
    return;
  }

  throw new Error(EMPTY_HASH_MESSAGE);
}

async function encryptPassword(password: string): Promise<string> {
  validatePassword(password);
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  return passwordHash;
}

async function verifyPassword(password: string, passwordHash: string,): Promise<boolean> {
  validatePassword(password);
  validatePasswordHash(passwordHash);
  const passwordMatches = await bcrypt.compare(password, passwordHash);
  return passwordMatches;
}

export { encryptPassword, verifyPassword };
