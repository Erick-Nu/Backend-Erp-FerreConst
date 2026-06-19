import { findBranchById } from '../branch/branchDao.js';
import { findCompanyById } from '../company/companyDao.js';
import { logger } from '../../utils/logger.js';
import { validateRequiredString } from '../../utils/validation.js';
import type {
  CreateSequenceDto,
  FindSequenceDto,
  SequenceResponseDto,
} from './sequenceDto.js';
import { findSequence, saveSequence } from './sequenceDao.js';

const EMPTY_COMPANY_ID_MESSAGE = 'El id de empresa es requerido';
const EMPTY_BRANCH_ID_MESSAGE = 'El id de sucursal es requerido';
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no esta activa';
const INVALID_BRANCH_FIND_MESSAGE = 'La sucursal no existe';
const INVALID_BRANCH_STATUS_MESSAGE = 'La sucursal no esta activa';
const INVALID_SEQUENCE_EXISTS_MESSAGE = 'Ya existe una secuencia para esta sucursal';

async function validateCompanyAccess(seemid: string): Promise<void> {
  const companyDB = await findCompanyById(seemid);
  if (!companyDB) {
    throw new Error(INVALID_COMPANY_FIND_MESSAGE);
  }

  const isActiveCompany = companyDB.emestado;
  if (isActiveCompany !== 'activo') {
    throw new Error(INVALID_COMPANY_STATUS_MESSAGE);
  }
}

async function createSequence(sequence: CreateSequenceDto): Promise<SequenceResponseDto> {
  
  const seemid = validateRequiredString(sequence.seemid, EMPTY_COMPANY_ID_MESSAGE);
  const sesuid = validateRequiredString(sequence.sesuid, EMPTY_BRANCH_ID_MESSAGE);

  try {
    await validateCompanyAccess(seemid);

    const branchDB = await findBranchById({
      suemid: seemid,
      suid: sesuid,
    });

    if (!branchDB) {
      throw new Error(INVALID_BRANCH_FIND_MESSAGE);
    }

    if (branchDB.suestado !== 'activo') {
      throw new Error(INVALID_BRANCH_STATUS_MESSAGE);
    }

    const existingSequenceDB = await findSequence({
      seemid,
      sesuid,
    });

    if (existingSequenceDB) {
      throw new Error(INVALID_SEQUENCE_EXISTS_MESSAGE);
    }

    await saveSequence({
      seemid,
      sesuid,
    });

    const newSequence = await findSequence({
      seemid,
      sesuid,
    });

    return newSequence!;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: seemid,
        branchId: sesuid,
      },
      'Error creating sequence',
    );
    throw error;
  }
}

async function readSequence(sequence: FindSequenceDto): Promise<SequenceResponseDto | null> {
  const seemid = validateRequiredString(sequence.seemid, EMPTY_COMPANY_ID_MESSAGE);
  const sesuid = validateRequiredString(sequence.sesuid, EMPTY_BRANCH_ID_MESSAGE);

  try {
    await validateCompanyAccess(seemid);

    const sequenceDB = await findSequence({
      seemid,
      sesuid,
    });

    if (!sequenceDB) {
      throw new Error('Secuencia no encontrada');
    }

    return sequenceDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: seemid,
        branchId: sesuid,
      },
      'Error reading sequence',
    );
    throw error;
  }
}

export { createSequence, readSequence };
