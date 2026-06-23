import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

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
