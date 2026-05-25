import { logger } from '../../utils/logger.js';
import { signAccessToken } from '../../utils/jwt.js';
import { verifyPassword } from '../../utils/bcrypt.js';
import { validateRequiredString, validateRuc } from '../../utils/validation.js';
import { toPublicImageUrl } from '../../middlewares/uploadImage.js';
import type { LoginDto, LoginResponseDto } from './authDto.js';
import { findAuthByRucAndNickname } from './authDao.js';

const EMPTY_RUC_MESSAGE = 'Company RUC is required';
const EMPTY_NICKNAME_MESSAGE = 'Nickname is required';
const EMPTY_PASSWORD_MESSAGE = 'Password is required';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';
const INACTIVE_USER_MESSAGE = 'User is inactive';
const INACTIVE_COMPANY_MESSAGE = 'Company is inactive';

async function login(credentials: LoginDto): Promise<LoginResponseDto> {
  const emruc = validateRequiredString(credentials.emruc, EMPTY_RUC_MESSAGE);
  validateRuc(emruc);
  const usapodo = validateRequiredString(credentials.usapodo, EMPTY_NICKNAME_MESSAGE);
  const uspassword = validateRequiredString(credentials.uspassword, EMPTY_PASSWORD_MESSAGE);

  try {
    const authDataDB = await findAuthByRucAndNickname(emruc, usapodo);

    if (!authDataDB) {
      throw new Error(INVALID_CREDENTIALS_MESSAGE);
    }

    if (authDataDB.emestado !== 'activo'){
      throw new Error(INACTIVE_COMPANY_MESSAGE);
    }

    const verifyPasswordDB = await verifyPassword(uspassword, authDataDB.uspassword);
    
    if (!verifyPasswordDB) {
      throw new Error(INVALID_CREDENTIALS_MESSAGE);
    }

    if (authDataDB.usestado !== 'activo') {
      throw new Error(INACTIVE_USER_MESSAGE);
    }

    const userToken = signAccessToken({
      usid: authDataDB.usid,
      usemid: authDataDB.emid,
      usrol: authDataDB.usrol,
    });

    const loginResponse: LoginResponseDto = {
      accessToken: userToken,
      company: {
        emid: authDataDB.emid,
        emruc: authDataDB.emruc,
        emrznsocial: authDataDB.emrznsocial,
        emlogo: toPublicImageUrl(authDataDB.emlogo),
        emestado: authDataDB.emestado,
        empadre: authDataDB.empadre
      },
      user: {
        usid: authDataDB.usid,
        usemid: authDataDB.usemid,
        usnombre: authDataDB.usnombre,
        usapodo: authDataDB.usapodo,
        uscorreo: authDataDB.uscorreo,
        usimagen: toPublicImageUrl(authDataDB.usimagen),
        usrol: authDataDB.usrol,
        usestado: authDataDB.usestado
      }
    }
    return loginResponse;
  } catch (error) {
    logger.error({ err: error, companyId: credentials.emruc, usuario: credentials.usapodo }, 'Error User Login');
    throw error;
  }
}

export { login };
