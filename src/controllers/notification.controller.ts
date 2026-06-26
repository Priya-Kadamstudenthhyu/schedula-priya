import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { notificationService } from '../services/notification.service';
import { sendAutomatedReminders } from '../services/reminder.scheduler';

// ════════════════════════════════════════════════════════════
// GET /api/notifications
// Patient views all their notifications, latest first
// ════════════════════════════════════════════════════════════
export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;

    const notifications = await prisma.notification.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });

    if (notifications.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No notifications found.',
        data: []
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notifications fetched successfully.',
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

// ════════════════════════════════════════════════════════════
// PATCH /api/notifications/:id/read
// Mark a single notification as read
// ════════════════════════════════════════════════════════════
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;
    const id = req.params.id as string;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }

    // Authorization: patient can only access their own notifications
    if (notification.patientId !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. You can only access your own notifications.'
      });
    }

    if (notification.isRead) {
      return res.status(400).json({
        success: false,
        message: 'Notification is already marked as read.'
      });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// ════════════════════════════════════════════════════════════
// PATCH /api/notifications/read-all
// Mark all notifications as read for the logged-in patient
// ════════════════════════════════════════════════════════════
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;

    const unreadCount = await prisma.notification.count({
      where: { patientId, isRead: false }
    });

    if (unreadCount === 0) {
      return res.status(200).json({
        success: true,
        message: 'No unread notifications to mark as read.'
      });
    }

    await prisma.notification.updateMany({
      where: { patientId, isRead: false },
      data: { isRead: true }
    });

    res.status(200).json({
      success: true,
      message: `${unreadCount} notification(s) marked as read.`
    });
  } catch (error) {
    next(error);
  }
};

// ════════════════════════════════════════════════════════════
// GET /api/notifications/unread-count
// Returns the count of unread notifications
// ════════════════════════════════════════════════════════════
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;

    const count = await prisma.notification.count({
      where: { patientId, isRead: false }
    });

    res.status(200).json({
      success: true,
      message: 'Unread notification count fetched successfully.',
      unreadCount: count
    });
  } catch (error) {
    next(error);
  }
};

// ════════════════════════════════════════════════════════════
// POST /api/notifications/reminders/trigger
// Triggers reminders for all upcoming appointments today
// ════════════════════════════════════════════════════════════
export const triggerRemindersBulk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await sendAutomatedReminders();
    res.status(200).json({
      success: true,
      message: 'Automated reminders triggered successfully.',
      remindersSent: count
    });
  } catch (error) {
    next(error);
  }
};

// ════════════════════════════════════════════════════════════
// POST /api/notifications/reminders/:appointmentId
// Trigger reminder for a specific appointment ID
// ════════════════════════════════════════════════════════════
export const triggerReminderForAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;
    const appointmentId = req.params.appointmentId as string;

    // 1. UUID validation check (Invalid appointment data)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment data.'
      });
    }

    // 2. Fetch the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            doctorProfile: true
          }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    // 3. Authorization check
    if (appointment.patientId !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. You can only trigger reminders for your own appointments.'
      });
    }

    // 4. Appointment already cancelled
    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled.'
      });
    }

    // 5. Appointment already completed
    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already completed.'
      });
    }

    // 6. Check if appointment is within reminder window (scheduled for today)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const appointmentDate = new Date(appointment.date);
    appointmentDate.setUTCHours(0, 0, 0, 0);

    if (appointmentDate.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Appointment is not within the reminder window.'
      });
    }

    // 7. Generate reminder message content
    const doctorProfile = appointment.doctor.doctorProfile;
    const schedulingType = doctorProfile?.schedulingType || 'STREAM';
    const doctorDisplayName = appointment.doctor.name.toLowerCase().startsWith('dr.')
      ? appointment.doctor.name
      : `Dr. ${appointment.doctor.name}`;

    let message = '';
    if (schedulingType === 'WAVE') {
      const reportingTime = notificationService.formatTime(appointment.startTime);
      const tokenNumber = appointment.tokenNumber ?? 'N/A';
      message = `Reminder: You have an appointment with ${doctorDisplayName} today.\n\nReporting Time: ${reportingTime}\n\nToken Number: ${tokenNumber}`;
    } else {
      const formattedDate = notificationService.formatDate(appointment.date);
      const formattedTime = notificationService.formatTime(appointment.startTime);
      message = `Reminder: You have an appointment with ${doctorDisplayName} today.\n\nAppointment Date: ${formattedDate}\n\nAppointment Time: ${formattedTime}`;
    }

    // 8. Check if reminder already sent
    const existing = await prisma.notification.findFirst({
      where: {
        patientId: appointment.patientId,
        type: 'APPOINTMENT_REMINDER',
        message: message
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Reminder already sent.'
      });
    }

    // 9. Create the notification
    const notification = await notificationService.create({
      patientId: appointment.patientId,
      title: 'Appointment Reminder',
      message: message,
      type: 'APPOINTMENT_REMINDER'
    });

    res.status(200).json({
      success: true,
      message: 'Reminder sent successfully.',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};
