import { Request, Response, NextFunction } from 'express';
import { bookAppointmentSchema, rescheduleAppointmentSchema } from '../validators/appointment.validator';
import prisma from '../lib/prisma';
import { findNextAvailableSlots, isSlotInPast, addMinutesToTime } from '../services/slot.service';
import { notificationService } from '../services/notification.service';

// Helper to get the local Date object for the appointment start time
function getAppointmentStartDateTime(date: Date, startTime: string): Date {
  const apptDate = new Date(date);
  const [hours, mins] = startTime.split(':').map(Number);
  return new Date(
    apptDate.getUTCFullYear(),
    apptDate.getUTCMonth(),
    apptDate.getUTCDate(),
    hours,
    mins,
    0,
    0
  );
}

// Wrapper around the shared slot service for providing single slot suggestions
async function findNextAvailableSlot(
  doctorId: string,
  requestedDate: Date,
  requestedStartTime: string,
  currentAppointmentId?: string
): Promise<any | null> {
  const suggestedSlot = await findNextAvailableSlots(doctorId, requestedDate, {
    requestedStartTime,
    returnSingleSlot: true,
    currentAppointmentId
  });

  return suggestedSlot && suggestedSlot.slots.length > 0
    ? {
        date: suggestedSlot.date,
        ...suggestedSlot.slots[0]
      }
    : null;
}



// ════════════════════════════════════════════════════════════
// PATIENT APPOINTMENT BOOKING
// ════════════════════════════════════════════════════════════

// POST /api/appointment
export const bookAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;
    const parsed = bookAppointmentSchema.parse(req.body);

    // Verify patient profile/user exists
    const patient = await prisma.user.findUnique({
      where: { id: patientId }
    });
    if (!patient || patient.role !== 'PATIENT') {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const parsedDate = new Date(parsed.date);
    parsedDate.setUTCHours(0, 0, 0, 0);

    // 1. Check if Doctor exists
    const doctor = await prisma.user.findUnique({
      where: { id: parsed.doctorId },
      include: { doctorProfile: true }
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // 2. Validate past date/time
    if (isSlotInPast(parsedDate, parsed.startTime)) {
      return res.status(400).json({ success: false, message: 'Cannot book an appointment in the past.' });
    }

    // 3. Resolve Availability (Custom Override > Recurring)
    const schedulingType = doctor.doctorProfile?.schedulingType || 'STREAM';
    const slotDuration = doctor.doctorProfile?.slotDuration || 15;
    const bufferTime = doctor.doctorProfile?.bufferTime || 0;
    const waveCapacity = doctor.doctorProfile?.waveCapacity || 5;

    let availableWindows: { startTime: string; endTime: string }[] = [];
    const customAvailability = await prisma.customAvailability.findMany({
      where: { doctorId: parsed.doctorId, date: parsedDate },
      orderBy: { startTime: 'asc' },
    });

    if (customAvailability.length > 0) {
      availableWindows = customAvailability;
    } else {
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = dayNames[parsedDate.getDay()] as any;
      const recurringAvailability = await prisma.recurringAvailability.findMany({
        where: { doctorId: parsed.doctorId, dayOfWeek },
        orderBy: { startTime: 'asc' },
      });
      availableWindows = recurringAvailability;
    }

    if (availableWindows.length === 0) {
      const suggestedSlot = await findNextAvailableSlot(parsed.doctorId, parsedDate, parsed.startTime);
      return res.status(400).json({
        success: false,
        message: 'Doctor is not available on this date.',
        suggestedSlot
      });
    }

    let assignedToken: number | null = null;

    if (schedulingType === 'STREAM') {
      // Stream Scheduling Validation
      let isValidSlot = false;
      for (const window of availableWindows) {
        let currentStartTime = window.startTime;
        while (currentStartTime < window.endTime) {
          const currentEndTime = addMinutesToTime(currentStartTime, slotDuration);
          if (currentEndTime > window.endTime) break;
          
          if (currentStartTime === parsed.startTime && currentEndTime === parsed.endTime) {
            isValidSlot = true;
            break;
          }
          currentStartTime = addMinutesToTime(currentEndTime, bufferTime);
        }
        if (isValidSlot) break;
      }

      if (!isValidSlot) {
        const suggestedSlot = await findNextAvailableSlot(parsed.doctorId, parsedDate, parsed.startTime);
        return res.status(400).json({
          success: false,
          message: 'Invalid slot. This slot is not offered by the doctor.',
          suggestedSlot
        });
      }

      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          doctorId: parsed.doctorId,
          date: parsedDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          status: 'SCHEDULED'
        }
      });

      if (existingAppointment) {
        const suggestedSlot = await findNextAvailableSlot(parsed.doctorId, parsedDate, parsed.startTime);
        return res.status(409).json({
          success: false,
          message: 'This exact slot is already booked.',
          suggestedSlot
        });
      }

    } else if (schedulingType === 'WAVE') {
      // Wave Scheduling Validation
      const validWave = availableWindows.find(w => w.startTime === parsed.startTime && w.endTime === parsed.endTime);
      
      if (!validWave) {
        const suggestedSlot = await findNextAvailableSlot(parsed.doctorId, parsedDate, parsed.startTime);
        return res.status(400).json({
          success: false,
          message: 'Invalid wave window. Please select an exact availability window.',
          suggestedSlot
        });
      }

      const existingAppointmentsInWave = await prisma.appointment.count({
        where: {
          doctorId: parsed.doctorId,
          date: parsedDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          status: 'SCHEDULED'
        }
      });

      if (existingAppointmentsInWave >= waveCapacity) {
        const suggestedSlot = await findNextAvailableSlot(parsed.doctorId, parsedDate, parsed.startTime);
        return res.status(409).json({
          success: false,
          message: 'This wave window is completely full.',
          suggestedSlot
        });
      }

      assignedToken = existingAppointmentsInWave + 1;
    }

    // 5. Create Appointment
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: parsed.doctorId,
        patientId,
        date: parsedDate,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        tokenNumber: assignedToken,
        status: 'SCHEDULED'
      }
    });

    // 6. Create notification for patient
    const doctorDisplayName = doctor.name.toLowerCase().startsWith('dr.') ? doctor.name : `Dr. ${doctor.name}`;
    const formattedDate = notificationService.formatDate(parsedDate);
    const formattedTime = notificationService.formatTime(parsed.startTime);
    const notificationMessage = `Your appointment with ${doctorDisplayName} has been booked successfully for ${formattedDate} at ${formattedTime}.`;

    await notificationService.create({
      patientId,
      title: 'Appointment Booked',
      message: notificationMessage,
      type: 'APPOINTMENT_BOOKED'
    });

    res.status(201).json({ success: true, message: 'Appointment booked successfully.', data: appointment });
  } catch (error) {
    next(error);
  }
};

// GET /api/appointment/my
export const getPatientAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;

    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            name: true,
            email: true,
            doctorProfile: {
              select: { specialization: true, consultationFee: true }
            }
          }
        }
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });

    res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/appointment/:id/cancel
export const cancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;
    const id = req.params.id as string;

    // Verify patient profile/user exists
    const patient = await prisma.user.findUnique({
      where: { id: patientId }
    });
    if (!patient || patient.role !== 'PATIENT') {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id }
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (appointment.patientId !== patientId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this appointment.' });
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Appointment is already cancelled.' });
    }

    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed appointment.' });
    }

    const apptDateTime = getAppointmentStartDateTime(appointment.date, appointment.startTime);
    const now = new Date();
    if (apptDateTime.getTime() - now.getTime() < 30 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel or reschedule an appointment if less than 30 minutes are left before the appointment start time.'
      });
    }

    const cancelledAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    // Notify patient about cancellation
    const formattedDate = notificationService.formatDate(appointment.date);
    const formattedTime = notificationService.formatTime(appointment.startTime);
    const notificationMessage = `Your appointment scheduled on ${formattedDate} at ${formattedTime} has been cancelled.`;

    await notificationService.create({
      patientId: appointment.patientId,
      title: 'Appointment Cancelled',
      message: notificationMessage,
      type: 'APPOINTMENT_CANCELLED'
    });

    res.status(200).json({ success: true, message: 'Appointment cancelled successfully.', data: cancelledAppointment });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/appointment/:id/reschedule
export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const patientId = (req as any).user.id;

    // Verify patient profile/user exists
    const patient = await prisma.user.findUnique({
      where: { id: patientId }
    });
    if (!patient || patient.role !== 'PATIENT') {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // 1. Validate body schema
    const parsed = rescheduleAppointmentSchema.parse(req.body);
    const parsedDate = new Date(parsed.date);
    parsedDate.setUTCHours(0, 0, 0, 0);

    // 2. Fetch the existing appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id }
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    // 3. Authorization check
    if (appointment.patientId !== patientId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to reschedule this appointment.' });
    }

    // 4. Status checks
    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot reschedule a cancelled appointment.' });
    }
    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Cannot reschedule a completed appointment.' });
    }

    // 5. Cutoff Time check on the old slot
    const oldApptDateTime = getAppointmentStartDateTime(appointment.date, appointment.startTime);
    const now = new Date();
    if (oldApptDateTime.getTime() - now.getTime() < 30 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel or reschedule an appointment if less than 30 minutes are left before the appointment start time.'
      });
    }

    // 6. Check if rescheduling to the same slot/time
    const isSameSlot =
      appointment.date.getTime() === parsedDate.getTime() &&
      appointment.startTime === parsed.startTime &&
      appointment.endTime === parsed.endTime;

    if (isSameSlot) {
      return res.status(400).json({ success: false, message: 'Cannot reschedule to the same slot and time.' });
    }

    // 7. Validate if new slot is in the past
    if (isSlotInPast(parsedDate, parsed.startTime)) {
      return res.status(400).json({ success: false, message: 'Cannot reschedule to a past date/time.' });
    }

    // 8. Fetch the doctor and their profile
    const doctor = await prisma.user.findUnique({
      where: { id: appointment.doctorId },
      include: { doctorProfile: true }
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const schedulingType = doctor.doctorProfile?.schedulingType || 'STREAM';
    const slotDuration = doctor.doctorProfile?.slotDuration || 15;
    const bufferTime = doctor.doctorProfile?.bufferTime || 0;
    const waveCapacity = doctor.doctorProfile?.waveCapacity || 5;

    // 9. Fetch availability windows for the new date
    let availableWindows: { startTime: string; endTime: string }[] = [];
    const customAvailability = await prisma.customAvailability.findMany({
      where: { doctorId: appointment.doctorId, date: parsedDate },
      orderBy: { startTime: 'asc' },
    });

    if (customAvailability.length > 0) {
      availableWindows = customAvailability;
    } else {
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = dayNames[parsedDate.getDay()] as any;
      const recurringAvailability = await prisma.recurringAvailability.findMany({
        where: { doctorId: appointment.doctorId, dayOfWeek },
        orderBy: { startTime: 'asc' },
      });
      availableWindows = recurringAvailability;
    }

    // If no availability windows exist for that day, suggest the next available slot
    if (availableWindows.length === 0) {
      const suggestedSlot = await findNextAvailableSlot(appointment.doctorId, parsedDate, parsed.startTime, appointment.id);
      return res.status(400).json({
        success: false,
        message: 'Doctor is not available on this date.',
        suggestedSlot
      });
    }

    let assignedToken: number | null = null;

    if (schedulingType === 'STREAM') {
      // Stream Scheduling Validation
      let isValidSlot = false;
      for (const window of availableWindows) {
        let currentStartTime = window.startTime;
        while (currentStartTime < window.endTime) {
          const currentEndTime = addMinutesToTime(currentStartTime, slotDuration);
          if (currentEndTime > window.endTime) break;
          
          if (currentStartTime === parsed.startTime && currentEndTime === parsed.endTime) {
            isValidSlot = true;
            break;
          }
          currentStartTime = addMinutesToTime(currentEndTime, bufferTime);
        }
        if (isValidSlot) break;
      }

      if (!isValidSlot) {
        const suggestedSlot = await findNextAvailableSlot(appointment.doctorId, parsedDate, parsed.startTime, appointment.id);
        return res.status(400).json({
          success: false,
          message: 'Invalid slot. This slot is not offered by the doctor.',
          suggestedSlot
        });
      }

      // Check if slot is already booked (exclude current appointment since we are rescheduling it)
      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          date: parsedDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          status: 'SCHEDULED',
          NOT: { id: appointment.id }
        }
      });

      if (existingAppointment) {
        const suggestedSlot = await findNextAvailableSlot(appointment.doctorId, parsedDate, parsed.startTime, appointment.id);
        return res.status(409).json({
          success: false,
          message: 'This exact slot is already booked.',
          suggestedSlot
        });
      }

    } else if (schedulingType === 'WAVE') {
      // Wave Scheduling Validation
      const validWave = availableWindows.find(w => w.startTime === parsed.startTime && w.endTime === parsed.endTime);
      
      if (!validWave) {
        const suggestedSlot = await findNextAvailableSlot(appointment.doctorId, parsedDate, parsed.startTime, appointment.id);
        return res.status(400).json({
          success: false,
          message: 'Invalid wave window. Please select an exact availability window.',
          suggestedSlot
        });
      }

      // Count booked appointments in the target wave (exclude current appointment)
      const existingAppointmentsInWave = await prisma.appointment.count({
        where: {
          doctorId: appointment.doctorId,
          date: parsedDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          status: 'SCHEDULED',
          NOT: { id: appointment.id }
        }
      });

      if (existingAppointmentsInWave >= waveCapacity) {
        const suggestedSlot = await findNextAvailableSlot(appointment.doctorId, parsedDate, parsed.startTime, appointment.id);
        return res.status(409).json({
          success: false,
          message: 'This wave window is completely full.',
          suggestedSlot
        });
      }

      assignedToken = existingAppointmentsInWave + 1;
    }

    // 10. Perform Rescheduling safely in a transaction with Serializable isolation level
    const updatedAppointment = await prisma.$transaction(async (tx) => {
      // Re-verify slot availability to prevent race conditions
      if (schedulingType === 'STREAM') {
        const existingAppointment = await tx.appointment.findFirst({
          where: {
            doctorId: appointment.doctorId,
            date: parsedDate,
            startTime: parsed.startTime,
            endTime: parsed.endTime,
            status: 'SCHEDULED',
            NOT: { id: appointment.id }
          }
        });
        if (existingAppointment) {
          throw new Error('SLOT_BOOKED');
        }
      } else if (schedulingType === 'WAVE') {
        const existingAppointmentsInWave = await tx.appointment.count({
          where: {
            doctorId: appointment.doctorId,
            date: parsedDate,
            startTime: parsed.startTime,
            endTime: parsed.endTime,
            status: 'SCHEDULED',
            NOT: { id: appointment.id }
          }
        });
        if (existingAppointmentsInWave >= waveCapacity) {
          throw new Error('WAVE_FULL');
        }
        assignedToken = existingAppointmentsInWave + 1;
      }

      // Update the appointment (releasing old slot by changing the values, reserving the new slot)
      return await tx.appointment.update({
        where: { id },
        data: {
          date: parsedDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          tokenNumber: assignedToken
        }
      });
    }, {
      isolationLevel: 'Serializable'
    });

    // Notify patient about rescheduling
    const formattedDate = notificationService.formatDate(parsedDate);
    const formattedTime = notificationService.formatTime(parsed.startTime);
    const notificationMessage = `Your appointment has been rescheduled to ${formattedDate} at ${formattedTime}.`;

    await notificationService.create({
      patientId: appointment.patientId,
      title: 'Appointment Rescheduled',
      message: notificationMessage,
      type: 'APPOINTMENT_RESCHEDULED'
    });

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully.',
      data: updatedAppointment
    });

  } catch (error: any) {
    if (error.message === 'SLOT_BOOKED' || error.message === 'WAVE_FULL') {
      try {
        const appt = await prisma.appointment.findUnique({ where: { id } });
        if (appt) {
          const parsedDate = new Date(req.body.date);
          parsedDate.setUTCHours(0,0,0,0);
          const suggestedSlot = await findNextAvailableSlot(appt.doctorId, parsedDate, req.body.startTime, appt.id);
          return res.status(409).json({
            success: false,
            message: error.message === 'SLOT_BOOKED' ? 'This exact slot is already booked.' : 'This wave window is completely full.',
            suggestedSlot
          });
        }
      } catch (innerErr) {
        return next(innerErr);
      }
    }
    next(error);
  }
};

// ════════════════════════════════════════════════════════════
// DOCTOR APPOINTMENT VIEW
// ════════════════════════════════════════════════════════════

// GET /api/doctor/appointments
export const getDoctorAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = (req as any).user.id;
    const { date } = req.query;

    let dateFilter: Date | undefined;
    if (date) {
      if (typeof date !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid date filter format.' });
      }
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      parsedDate.setUTCHours(0, 0, 0, 0);
      dateFilter = parsedDate;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        status: { not: 'CANCELLED' },
        date: dateFilter ? dateFilter : undefined
      },
      include: {
        patient: {
          select: {
            name: true,
            email: true,
            patientProfile: {
              select: { age: true, gender: true, contactDetails: true }
            }
          }
        },
        doctor: {
          select: {
            doctorProfile: {
              select: {
                schedulingType: true
              }
            }
          }
        }
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });

    const formatted = appointments.map(appt => ({
      id: appt.id,
      doctorId: appt.doctorId,
      patientId: appt.patientId,
      date: appt.date.toISOString().split('T')[0],
      startTime: appt.startTime,
      endTime: appt.endTime,
      tokenNumber: appt.tokenNumber,
      status: appt.status,
      createdAt: appt.createdAt,
      updatedAt: appt.updatedAt,
      schedulingType: appt.doctor?.doctorProfile?.schedulingType || 'STREAM',
      patient: appt.patient
    }));

    if (formatted.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No appointments found.',
        data: []
      });
    }

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/doctor/appointments/:id/cancel
export const doctorCancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const doctorId = (req as any).user.id;

    // 1. Fetch the existing appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id }
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    // Verify patient profile/user exists
    const patient = await prisma.user.findUnique({
      where: { id: appointment.patientId }
    });
    if (!patient || patient.role !== 'PATIENT') {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // 2. Authorization check
    if (appointment.doctorId !== doctorId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this appointment.' });
    }

    // 3. Status checks
    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Appointment is already cancelled.' });
    }

    // 4. Cancel the appointment
    const cancelledAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    // Notify patient about cancellation
    const formattedDate = notificationService.formatDate(appointment.date);
    const formattedTime = notificationService.formatTime(appointment.startTime);
    const notificationMessage = `Your appointment scheduled on ${formattedDate} at ${formattedTime} has been cancelled.`;

    await notificationService.create({
      patientId: appointment.patientId,
      title: 'Appointment Cancelled',
      message: notificationMessage,
      type: 'APPOINTMENT_CANCELLED'
    });

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully.',
      data: cancelledAppointment
    });
  } catch (error) {
    next(error);
  }
};
