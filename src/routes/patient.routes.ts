import { Router } from 'express';
import { getPatientProfile, createPatientProfile, updatePatientProfile } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';

const router = Router();

// Apply Authentication and Role Guard ('PATIENT') to all routes in this file
router.use(authenticate, authorizeRole('PATIENT'));

// Profile Routes
router.post('/profile', createPatientProfile);
router.get('/profile', getPatientProfile);
router.patch('/profile', updatePatientProfile);

export default router;
