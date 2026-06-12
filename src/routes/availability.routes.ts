import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorizeRole } from '../middlewares/role.middleware';
import {
  createRecurringAvailability,
  getRecurringAvailability,
  updateRecurringAvailability,
  deleteRecurringAvailability,
  createCustomAvailability,
  getAvailabilityByDate,
} from '../controllers/availability.controller';

const router = Router();

// All availability routes require authentication + DOCTOR role
const doctorOnly = [authenticate, authorizeRole('DOCTOR')];

// ── Recurring Weekly Availability ──────────────────────────
router.post('/', doctorOnly, createRecurringAvailability);
router.get('/', doctorOnly, getRecurringAvailability);
router.patch('/:id', doctorOnly, updateRecurringAvailability);
router.delete('/:id', doctorOnly, deleteRecurringAvailability);

// ── Custom Date Override ───────────────────────────────────
router.post('/override', doctorOnly, createCustomAvailability);
router.get('/date', doctorOnly, getAvailabilityByDate);

export default router;
