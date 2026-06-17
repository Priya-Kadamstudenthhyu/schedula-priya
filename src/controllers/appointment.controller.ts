import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { bookAppointmentSchema, rescheduleAppointmentSchema } from '../validators/appointment.validator';

const prisma = new PrismaClient();

// Helper to check if a slot is in the past (Re-used from slot.controller logic)
function isSlotInPast(date: Date, slotStartTime: string): boolean {
  const now = new Date();
  
  if (
    date.getUTCFullYear() < now.getUTCFullYear() ||
    (date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() < now.getUTCMonth()) ||
    (date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth() && date.getUTCDate() < now.getUTCDate())
  ) {
    return true;
  }

  if (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  ) {
    const [slotHours, slotMins] = slotStartTime.split(':').map(Number);
    const currentHours = now.getHours();
    const currentMins = now.getMinutes();
    
    if (slotHours < currentHours) return true;
    if (slotHours === currentHours && slotMins <= currentMins) return true;
  }

  return false;
}

// Helper to add minutes to a "HH:MM" string
function addMinutesToTime(time: string, minsToAdd: number): string {
  const [hoursStr, minsStr] = time.split(':');
  let hours = parseInt(hoursStr, 10);
  let mins = parseInt(minsStr, 10);

  mins += minsToAdd;
  hours += Math.floor(mins / 60);
  mins = mins % 60;

  const h = hours.toString().padStart(2, '0');
  const m = mins.toString().padStart(2, '0');
  return `${h}:${m}`;
}

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

// Helper to find the next available slot for a doctor starting from requestedDate
async function findNextAvailableSlot(
  doctorId: string,
  requestedDate: Date,
  requestedStartTime: string,
  currentAppointmentId?: string
): Promise<any | null> {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true }
  });
  if (!doctor || !doctor.doctorProfile) return null;

  const schedulingType = doctor.doctorProfile.schedulingType;
  const slotDuration = doctor.doctorProfile.slotDuration;
  const bufferTime = doctor.doctorProfile.bufferTime;
  const waveCapacity = doctor.doctorProfile.waveCapacity;

  let currentDate = new Date(requestedDate);
  const maxSearchDays = 30;

  for (let i = 0; i < maxSearchDays; i++) {
    let windows: { startTime: string; endTime: string }[] = [];
    const customAvailability = await prisma.customAvailability.findMany({
      where: { doctorId, date: currentDate },
      orderBy: { startTime: 'asc' },
    });

    if (customAvailability.length > 0) {
      windows = customAvailability;
    } else {
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = dayNames[currentDate.getDay()] as any;
      const recurringAvailability = await prisma.recurringAvailability.findMany({
        where: { doctorId, dayOfWeek },
        orderBy: { startTime: 'asc' },
      });
      windows = recurringAvailability;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: currentDate,
        status: 'SCHEDULED',
        NOT: currentAppointmentId ? { id: currentAppointmentId } : undefined
      }
    });

    const isSameDate = currentDate.getTime() === requestedDate.getTime();

    if (schedulingType === 'STREAM') {
      const bookedSlots = new Set(appointments.map(a => `${a.startTime}-${a.endTime}`));

      for (const window of windows) {
        let currentStartTime = window.startTime;

        while (currentStartTime < window.endTime) {
          const currentEndTime = addMinutesToTime(currentStartTime, slotDuration);
          if (currentEndTime > window.endTime) break;

          const slotKey = `${currentStartTime}-${currentEndTime}`;
          const isPast = isSlotInPast(currentDate, currentStartTime);
          const isBooked = bookedSlots.has(slotKey);
          const isAfterRequest = !isSameDate || currentStartTime > requestedStartTime;

          if (!isPast && !isBooked && isAfterRequest) {
            return {
              date: currentDate.toISOString().split('T')[0],
              startTime: currentStartTime,
              endTime: currentEndTime
            };
          }

          currentStartTime = addMinutesToTime(currentEndTime, bufferTime);
        }
      }
    } else if (schedulingType === 'WAVE') {
      for (const window of windows) {
        const bookedInWave = appointments.filter(
          a => a.startTime === window.startTime && a.endTime === window.endTime
        ).length;

        const isPast = isSlotInPast(currentDate, window.startTime);
        const isAfterRequest = !isSameDate || window.startTime > requestedStartTime;

        if (!isPast && bookedInWave < waveCapacity && isAfterRequest) {
          return {
            date: currentDate.toISOString().split('T')[0],
            startTime: window.startTime,
            endTime: window.endTime,
            availableCapacity: waveCapacity - bookedInWave
          };
        }
      }
    }

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setUTCHours(0, 0, 0, 0);
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// PATIENT APPOINTMENT BOOKING
// ════════════════════════════════════════════════════════════

// POST /api/appointment
export const bookAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.id;
    const parsed = bookAppointmentSchema.parse(req.body);

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

    const appointments = await prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patient: {
          select: {
            name: true,
            email: true,
            patientProfile: {
              select: { age: true, gender: true, contactDetails: true }
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
