import { Router } from 'express';
import { getPatientProfile } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';

const router = Router();

// Route protected by Authentication AND Role Guard for 'PATIENT'
router.get('/profile', authenticate, authorizeRole('PATIENT'), getPatientProfile);

export default router;
