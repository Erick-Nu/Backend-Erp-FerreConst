import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type {
  CreateBranchDto,
  FindBranchDto,
  FindBranchesParamsDto,
  UpdateBranchDto,
} from './branchDto.js';
import { createBranch, readBranch, readBranches, updateBranch } from './branchService.js';
import { isValidStatus } from '../../utils/validation.js';

type UpdateBranchRequestBody = Omit<UpdateBranchDto, 'suid'>;

const registerBranch: RequestHandler = async (req, res, next) => {
  try {
    const { suemid, sunombre, suidentificador, sudireccion, sucorreo } = req.body;
    const branch: CreateBranchDto = {
      suemid,
      sunombre,
      suidentificador,
      sudireccion: sudireccion ?? null,
      sucorreo: sucorreo ?? null,
    };
    const user: LoginUserDto = req.auth!;

    const branchDB = await createBranch(branch, user);

    res.status(201).json(branchDB);
  } catch (error) {
    next(error);
  }
};

const searchBranches: RequestHandler = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;
    const searchQuery = req.query.search;
    const statusQuery = req.query.status;

    if (Array.isArray(searchQuery)) {
      res.status(400).json({ message: 'Search must be a string' });
      return;
    }

    if (Array.isArray(statusQuery)) {
      res.status(400).json({ message: 'Status must be a string' });
      return;
    }

    if (typeof statusQuery === 'string' && !isValidStatus(statusQuery)) {
      res.status(400).json({ message: 'Status must be activo or inactivo' });
      return;
    }

    const page = Number(pageQuery);
    const pageSize = Number(pageSizeQuery);

    const params: FindBranchesParamsDto = {
      page,
      pageSize,
    };

    if (typeof searchQuery === 'string') {
      params.search = searchQuery;
    }

    if (typeof statusQuery === 'string' && isValidStatus(statusQuery)) {
      params.status = statusQuery;
    }

    const user: LoginUserDto = req.auth!;
    const branchesDB = await readBranches(params, user);

    res.status(200).json(branchesDB);
  } catch (error) {
    next(error);
  }
};

const searchBranch: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Branch id is required' });
      return;
    }

    const branch: FindBranchDto = {
      suid: id,
    };
    const user: LoginUserDto = req.auth!;
    
    const branchDB = await readBranch(branch, user);

    if (!branchDB) {
      res.status(404).json({ message: 'Branch not found' });
      return;
    }

    res.status(200).json(branchDB);
  } catch (error) {
    next(error);
  }
};

const updateBranchData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'Branch id is required' });
      return;
    }

    const body: UpdateBranchRequestBody = req.body;
    const { sunombre, sudireccion, sucorreo, suidentificador, suestado } = body;
    const branch: UpdateBranchDto = {
      suid: id,
    };

    if (sunombre !== undefined) {
      branch.sunombre = sunombre;
    }

    if (sudireccion !== undefined) {
      branch.sudireccion = sudireccion;
    }

    if (sucorreo !== undefined) {
      branch.sucorreo = sucorreo;
    }

    if (suidentificador !== undefined) {
      branch.suidentificador = suidentificador;
    }

    if (suestado !== undefined) {
      branch.suestado = suestado;
    }

    const user: LoginUserDto = req.auth!;
    const updatedBranch = await updateBranch(branch, user);

    if (!updatedBranch) {
      res.status(404).json({ message: 'Branch not found' });
      return;
    }

    res.status(200).json(updatedBranch);
  } catch (error) {
    next(error);
  }
};

export { registerBranch, searchBranches, searchBranch, updateBranchData };
