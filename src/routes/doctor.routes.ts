import { Router } from 'express';
import { getDoctorProfile, createDoctorProfile, updateDoctorProfile } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';

const router = Router();

// Apply Authentication and Role Guard ('DOCTOR') to all routes in this file
router.use(authenticate, authorizeRole('DOCTOR'));

// Profile Routes
router.post('/profile', createDoctorProfile);
router.get('/profile', getDoctorProfile);
router.patch('/profile', updateDoctorProfile);

export default router;
