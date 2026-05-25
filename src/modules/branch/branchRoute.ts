import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { registerBranch, searchBranch, searchBranches, updateBranchData } from './branchController.js';

const branchRouter = Router();

branchRouter.post('/', authenticate, registerBranch);
branchRouter.get('/', authenticate, searchBranches);
branchRouter.get('/:id', authenticate, searchBranch);
branchRouter.patch('/:id', authenticate, updateBranchData);

export { branchRouter };
