import prisma from '../lib/prisma';
import { NotificationType, Notification } from '@prisma/client';

export class NotificationService {
  /**
   * Format Date to "25 June" format using UTC.
   */
  formatDate(date: Date): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    return `${day} ${month}`;
  }

  /**
   * Format 24h Time (e.g. "10:00") to 12h Time (e.g. "10:00 AM" or "2:30 PM").
   */
  formatTime(time24: string): string {
    const [hoursStr, minutesStr] = time24.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }

  /**
   * Create a new notification if it does not already exist with the same patientId, type, and message.
   */
  async create(data: {
    patientId: string;
    title: string;
    message: string;
    type: NotificationType;
  }): Promise<Notification> {
    const existing = await prisma.notification.findFirst({
      where: {
        patientId: data.patientId,
        type: data.type,
        message: data.message
      }
    });

    if (!existing) {
      return prisma.notification.create({
        data: {
          patientId: data.patientId,
          title: data.title,
          message: data.message,
          type: data.type
        }
      });
    }

    return existing;
  }
}

export const notificationService = new NotificationService();
