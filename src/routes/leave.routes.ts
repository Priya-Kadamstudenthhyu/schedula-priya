import { Router } from 'express';
import { createLeave, getLeaves, deleteLeave } from '../controllers/leave.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';

const router = Router();

// Only DOCTOR role can manage leaves
const doctorOnly = [authenticate, authorizeRole('DOCTOR')];

router.post('/', doctorOnly, createLeave);
router.get('/', doctorOnly, getLeaves);
router.delete('/:id', doctorOnly, deleteLeave);

export default router;
