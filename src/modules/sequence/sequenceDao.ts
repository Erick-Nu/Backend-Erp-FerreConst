import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

type CreateSequenceDao = {
  seemid: string;
  sesuid: string;
};

type FindSequenceDao = {
  seemid: string;
  sesuid: string;
};

type SequenceRowDao = {
  seid: string;
  seemid: string;
  sesuid: string;
  sevalor: number;
  sefchactualizacion: Date;
};

type SequenceCounterRowDao = {
  sevalor: number;
};

const SAVE_SEQUENCE_QUERY = `
  insert into secuencia (seemid, sesuid)
  values ($1, $2)
  returning seid
`;

async function saveSequence(sequence: CreateSequenceDao): Promise<string> {
  try {
    const result = await sql.unsafe<{ seid: string }[]>(SAVE_SEQUENCE_QUERY, [
      sequence.seemid,
      sequence.sesuid,
    ]);

    const sequenceDB = result[0];
    if (!sequenceDB) {
      throw new Error('Sequence was not created');
    }

    logger.info(
      {
        sequenceId: sequenceDB.seid,
        companyId: sequence.seemid,
        branchId: sequence.sesuid,
      },
      'Sequence created',
    );

    return sequenceDB.seid;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: sequence.seemid,
        branchId: sequence.sesuid,
      },
      'Error saving sequence',
    );
    throw new Error('Error saving sequence');
  }
}

const FIND_SEQUENCE_QUERY = `
  select seid, seemid, sesuid, sevalor, sefchactualizacion
  from secuencia
  where seemid = $1 and sesuid = $2
`;

async function findSequence(sequence: FindSequenceDao): Promise<SequenceRowDao | null> {
  try {
    const result = await sql.unsafe<SequenceRowDao[]>(FIND_SEQUENCE_QUERY, [
      sequence.seemid,
      sequence.sesuid,
    ]);
    const sequenceDB = result[0];

    if (!sequenceDB) {
      return null;
    }

    return sequenceDB;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId: sequence.seemid,
        branchId: sequence.sesuid,
      },
      'Error finding sequence',
    );
    throw new Error('Error finding sequence');
  }
}

const INCREMENT_SEQUENCE_QUERY = `
  update secuencia
  set sevalor = sevalor + 1,
      sefchactualizacion = current_timestamp
  where seemid = $1 and sesuid = $2
  returning sevalor
`;

async function incrementSequenceByCompanyAndBranch(
  companyId: string,
  branchId: string,
): Promise<number | null> {
  try {
    const result = await sql.unsafe<SequenceCounterRowDao[]>(INCREMENT_SEQUENCE_QUERY, [
      companyId,
      branchId,
    ]);
    const sequenceDB = result[0];

    if (!sequenceDB) {
      return null;
    }

    return sequenceDB.sevalor;
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId,
        branchId,
      },
      'Error incrementing sequence',
    );
    throw new Error('Error incrementing sequence');
  }
}

export { saveSequence, findSequence, incrementSequenceByCompanyAndBranch };
