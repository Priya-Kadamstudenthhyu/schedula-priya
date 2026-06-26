import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  triggerRemindersBulk,
  triggerReminderForAppointment
} from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /api/notifications — fetch all notifications (latest first)
router.get('/', getNotifications);

// GET /api/notifications/unread-count — must come before /:id to avoid route conflict
router.get('/unread-count', getUnreadCount);

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', markAllAsRead);

// POST /api/notifications/reminders/trigger — trigger all today's reminders
router.post('/reminders/trigger', triggerRemindersBulk);

// POST /api/notifications/reminders/:appointmentId — trigger reminder for specific appointment
router.post('/reminders/:appointmentId', triggerReminderForAppointment);

// PATCH /api/notifications/:id/read — mark single notification as read
router.patch('/:id/read', markAsRead);

export default router;
