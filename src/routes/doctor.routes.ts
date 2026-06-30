import { Router } from 'express';
import { getDoctorProfile, createDoctorProfile, updateDoctorProfile } from '../controllers/profile.controller';
import { getDoctors, getDoctorById } from '../controllers/discovery.controller';
import { getAvailableSlots } from '../controllers/slot.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';

import { getDoctorAppointments, doctorCancelAppointment } from '../controllers/appointment.controller';

const router = Router();

// ==========================================
// DOCTOR ONBOARDING ROUTES (Strictly DOCTOR)
// ==========================================
const doctorOnly = [authenticate, authorizeRole('DOCTOR')];

router.post('/profile', doctorOnly, createDoctorProfile);
router.get('/profile', doctorOnly, getDoctorProfile);
router.patch('/profile', doctorOnly, updateDoctorProfile);
router.get('/appointments', doctorOnly, getDoctorAppointments);
router.patch('/appointments/:id/cancel', doctorOnly, doctorCancelAppointment);

// ==========================================
// DOCTOR DISCOVERY ROUTES (Open to any logged-in user)
// ==========================================
router.get('/', authenticate, getDoctors);
router.get('/:doctorId/slots', authenticate, getAvailableSlots);
router.get('/:id', authenticate, getDoctorById);

export default router;
