import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

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

// Helper to check if a slot is in the past
function isSlotInPast(date: Date, slotStartTime: string): boolean {
  const now = new Date();
  
  // If the date is in the past, all slots are in the past
  if (
    date.getUTCFullYear() < now.getUTCFullYear() ||
    (date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() < now.getUTCMonth()) ||
    (date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth() && date.getUTCDate() < now.getUTCDate())
  ) {
    return true;
  }

  // If the date is today, check the specific time
  if (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  ) {
    const [slotHours, slotMins] = slotStartTime.split(':').map(Number);
    // Note: Assuming the local timezone matches UTC for simplicity, 
    // or use now.getHours() and now.getMinutes() if server time is considered local.
    // For this internship, we'll use local server time.
    const currentHours = now.getHours();
    const currentMins = now.getMinutes();
    
    if (slotHours < currentHours) return true;
    if (slotHours === currentHours && slotMins <= currentMins) return true;
  }

  return false;
}

// Helper to sequentially search next available working day slots for a doctor
async function findNextAvailableDaySlots(
  doctorId: string,
  startDate: Date
): Promise<{ date: string; schedulingType: string; slots: any[] } | null> {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true }
  });
  if (!doctor || !doctor.doctorProfile) return null;

  const schedulingType = doctor.doctorProfile.schedulingType;
  const slotDuration = doctor.doctorProfile.slotDuration;
  const bufferTime = doctor.doctorProfile.bufferTime;
  const waveCapacity = doctor.doctorProfile.waveCapacity;
  const searchWindow = doctor.doctorProfile.searchWindow;

  let currentDate = new Date(startDate);
  let workingDaysChecked = 0;
  const maxCalendarDaysLimit = 365;

  for (let calendarDay = 0; calendarDay < maxCalendarDaysLimit; calendarDay++) {
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

    const isWorkingDay = windows.length > 0;
    if (isWorkingDay) {
      workingDaysChecked++;

      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId,
          date: currentDate,
          status: 'SCHEDULED'
        }
      });

      const generatedSlots: any[] = [];

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

            if (!isPast && !isBooked) {
              generatedSlots.push({
                startTime: currentStartTime,
                endTime: currentEndTime
              });
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

          if (!isPast && bookedInWave < waveCapacity) {
            generatedSlots.push({
              timeWindow: `${window.startTime} - ${window.endTime}`,
              startTime: window.startTime,
              endTime: window.endTime,
              available: `${waveCapacity - bookedInWave}/${waveCapacity}`,
              isFull: bookedInWave >= waveCapacity
            });
          }
        }
      }

      if (generatedSlots.length > 0) {
        return {
          date: currentDate.toISOString().split('T')[0],
          schedulingType,
          slots: generatedSlots
        };
      }

      if (workingDaysChecked >= searchWindow) {
        break;
      }
    }

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setUTCHours(0, 0, 0, 0);
  }

  return null;
}

export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = req.params.doctorId as string;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, message: 'Date query parameter is required (YYYY-MM-DD).' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    parsedDate.setUTCHours(0, 0, 0, 0);

    // 1. Check if Doctor exists and get their slotDuration
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      include: { doctorProfile: true },
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const schedulingType = doctor.doctorProfile?.schedulingType || 'STREAM';
    const slotDuration = doctor.doctorProfile?.slotDuration || 15;
    const bufferTime = doctor.doctorProfile?.bufferTime || 0;
    const waveCapacity = doctor.doctorProfile?.waveCapacity || 5;
    const searchWindow = doctor.doctorProfile?.searchWindow || 30;

    // 2. Fetch Appointments for that date (to filter booked slots or calculate wave capacity)
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: parsedDate,
        status: 'SCHEDULED'
      }
    });

    // 3. Resolve Availability (Custom Override > Recurring)
    let availableWindows: { startTime: string; endTime: string }[] = [];

    const customAvailability = await prisma.customAvailability.findMany({
      where: { doctorId, date: parsedDate },
      orderBy: { startTime: 'asc' },
    });

    if (customAvailability.length > 0) {
      availableWindows = customAvailability;
    } else {
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = dayNames[parsedDate.getDay()] as any;

      const recurringAvailability = await prisma.recurringAvailability.findMany({
        where: { doctorId, dayOfWeek },
        orderBy: { startTime: 'asc' },
      });
      availableWindows = recurringAvailability;
    }

    // Note: if availableWindows is empty the next-available search below handles it

    // 4. Generate Slots based on Scheduling Type
    const generatedSlots = [];

    if (availableWindows.length > 0) {
      if (schedulingType === 'STREAM') {
        const bookedSlots = new Set(appointments.map(a => `${a.startTime}-${a.endTime}`));

        for (const window of availableWindows) {
          let currentStartTime = window.startTime;

          while (currentStartTime < window.endTime) {
            const currentEndTime = addMinutesToTime(currentStartTime, slotDuration);
            
            if (currentEndTime > window.endTime) break;

            const slotKey = `${currentStartTime}-${currentEndTime}`;
            const isPast = isSlotInPast(parsedDate, currentStartTime);
            const isBooked = bookedSlots.has(slotKey);

            if (!isPast && !isBooked) {
              generatedSlots.push({
                startTime: currentStartTime,
                endTime: currentEndTime,
              });
            }

            // Add buffer time for the next slot
            currentStartTime = addMinutesToTime(currentEndTime, bufferTime);
          }
        }
      } else if (schedulingType === 'WAVE') {
        for (const window of availableWindows) {
          // Find appointments booked exactly for this wave window
          const bookedInWave = appointments.filter(
            a => a.startTime === window.startTime && a.endTime === window.endTime
          ).length;

          const isPast = isSlotInPast(parsedDate, window.startTime);
          
          if (!isPast && bookedInWave < waveCapacity) {
            generatedSlots.push({
              timeWindow: `${window.startTime} - ${window.endTime}`,
              startTime: window.startTime,
              endTime: window.endTime,
              available: `${waveCapacity - bookedInWave}/${waveCapacity}`,
              isFull: bookedInWave >= waveCapacity
            });
          }
        }
      }
    }

    // 5. Evaluate availability and trigger Next Available search if empty
    let slotsToReturn = generatedSlots;
    let nextAvailableDate = date.split('T')[0];
    let nextAvailableSearchExecuted = false;

    if (availableWindows.length === 0 || generatedSlots.length === 0) {
      nextAvailableSearchExecuted = true;
      const nextDayResult = await findNextAvailableDaySlots(doctorId, parsedDate);

      if (!nextDayResult) {
        return res.status(200).json({
          success: true,
          message: `No appointments available in the next ${searchWindow} working days. Please try again later.`,
          slots: []
        });
      }

      nextAvailableDate = nextDayResult.date;
      slotsToReturn = nextDayResult.slots;
    }

    res.status(200).json({
      success: true,
      message: nextAvailableSearchExecuted
        ? `No available slots on the requested date. Suggesting next available day: ${nextAvailableDate}`
        : 'Available slots fetched successfully.',
      nextAvailableDate,
      schedulingType,
      slots: slotsToReturn
    });

  } catch (error) {
    next(error);
  }
};
