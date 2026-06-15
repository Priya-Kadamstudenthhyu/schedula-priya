import { Router } from 'express';
import { bookAppointment, getPatientAppointments, cancelAppointment } from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';

const router = Router();

// Only PATIENT can access these routes
const patientOnly = [authenticate, authorizeRole('PATIENT')];

router.post('/', patientOnly, bookAppointment);
router.get('/my', patientOnly, getPatientAppointments);
router.patch('/:id/cancel', patientOnly, cancelAppointment);

export default router;
