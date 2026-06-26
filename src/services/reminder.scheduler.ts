import cron from 'node-cron';
import prisma from '../lib/prisma';
import { notificationService } from './notification.service';

/**
 * Scans upcoming appointments scheduled for today (UTC midnight match)
 * and generates reminder notifications for those that don't already have one.
 * @returns The number of reminders sent.
 */
export async function sendAutomatedReminders(): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      date: today,
      status: 'SCHEDULED'
    },
    include: {
      doctor: {
        include: {
          doctorProfile: true
        }
      }
    }
  });

  let count = 0;

  for (const appointment of appointments) {
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

    // Check if reminder is already sent (deduplication)
    const existing = await prisma.notification.findFirst({
      where: {
        patientId: appointment.patientId,
        type: 'APPOINTMENT_REMINDER',
        message: message
      }
    });

    if (!existing) {
      await notificationService.create({
        patientId: appointment.patientId,
        title: 'Appointment Reminder',
        message: message,
        type: 'APPOINTMENT_REMINDER'
      });
      count++;
    }
  }

  return count;
}

// Setup background cron job to run every minute
cron.schedule('* * * * *', async () => {
  console.log('[Scheduler] Running automated appointment reminders check...');
  try {
    const remindersSent = await sendAutomatedReminders();
    if (remindersSent > 0) {
      console.log(`[Scheduler] Successfully sent ${remindersSent} automatic reminder(s).`);
    }
  } catch (error) {
    console.error('[Scheduler] Error running automated appointment reminders:', error);
  }
});
