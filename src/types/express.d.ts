import type { Role } from '../config/databaseTypes.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        usid: string;
        usemid: string;
        usrol: Role;
      };
    }
  }
}

export {};
