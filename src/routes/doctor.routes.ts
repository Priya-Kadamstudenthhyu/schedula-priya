import { Router } from 'express';
import { getDoctorProfile } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';

const router = Router();

// Route protected by Authentication AND Role Guard for 'DOCTOR'
router.get('/profile', authenticate, authorizeRole('DOCTOR'), getDoctorProfile);

export default router;
