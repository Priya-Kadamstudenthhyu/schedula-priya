"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAutomatedReminders = sendAutomatedReminders;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_service_1 = require("./notification.service");
/**
 * Scans upcoming appointments scheduled for today (UTC midnight match)
 * and generates reminder notifications for those that don't already have one.
 * @returns The number of reminders sent.
 */
async function sendAutomatedReminders() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const appointments = await prisma_1.default.appointment.findMany({
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
            const reportingTime = notification_service_1.notificationService.formatTime(appointment.startTime);
            const tokenNumber = appointment.tokenNumber ?? 'N/A';
            message = `Reminder: You have an appointment with ${doctorDisplayName} today.\n\nReporting Time: ${reportingTime}\n\nToken Number: ${tokenNumber}`;
        }
        else {
            const formattedDate = notification_service_1.notificationService.formatDate(appointment.date);
            const formattedTime = notification_service_1.notificationService.formatTime(appointment.startTime);
            message = `Reminder: You have an appointment with ${doctorDisplayName} today.\n\nAppointment Date: ${formattedDate}\n\nAppointment Time: ${formattedTime}`;
        }
        // Check if reminder is already sent (deduplication)
        const existing = await prisma_1.default.notification.findFirst({
            where: {
                patientId: appointment.patientId,
                type: 'APPOINTMENT_REMINDER',
                message: message
            }
        });
        if (!existing) {
            await notification_service_1.notificationService.create({
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
node_cron_1.default.schedule('* * * * *', async () => {
    console.log('[Scheduler] Running automated appointment reminders check...');
    try {
        const remindersSent = await sendAutomatedReminders();
        if (remindersSent > 0) {
            console.log(`[Scheduler] Successfully sent ${remindersSent} automatic reminder(s).`);
        }
    }
    catch (error) {
        console.error('[Scheduler] Error running automated appointment reminders:', error);
    }
});
