"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All notification routes require authentication
router.use(auth_middleware_1.authenticate);
// GET /api/notifications — fetch all notifications (latest first)
router.get('/', notification_controller_1.getNotifications);
// GET /api/notifications/unread-count — must come before /:id to avoid route conflict
router.get('/unread-count', notification_controller_1.getUnreadCount);
// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', notification_controller_1.markAllAsRead);
// POST /api/notifications/reminders/trigger — trigger all today's reminders
router.post('/reminders/trigger', notification_controller_1.triggerRemindersBulk);
// POST /api/notifications/reminders/:appointmentId — trigger reminder for specific appointment
router.post('/reminders/:appointmentId', notification_controller_1.triggerReminderForAppointment);
// PATCH /api/notifications/:id/read — mark single notification as read
router.patch('/:id/read', notification_controller_1.markAsRead);
exports.default = router;
