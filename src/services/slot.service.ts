import prisma from '../lib/prisma';

export function addMinutesToTime(time: string, minsToAdd: number): string {
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

export function isSlotInPast(date: Date, slotStartTime: string): boolean {
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

export function generateSlotsForDay(
  date: Date,
  windows: { startTime: string; endTime: string }[],
  appointments: any[],
  doctorProfile: any,
  requestedStartTime?: string,
  returnSingleSlot = false
): any[] {
  const generatedSlots: any[] = [];
  const { schedulingType, slotDuration, bufferTime, waveCapacity } = doctorProfile;
  const isSameDateAsRequest = requestedStartTime ? true : false; // When searching specific time

  if (schedulingType === 'STREAM') {
    const bookedSlots = new Set(appointments.map(a => `${a.startTime}-${a.endTime}`));

    for (const window of windows) {
      let currentStartTime = window.startTime;

      while (currentStartTime < window.endTime) {
        const currentEndTime = addMinutesToTime(currentStartTime, slotDuration);
        if (currentEndTime > window.endTime) break;

        const slotKey = `${currentStartTime}-${currentEndTime}`;
        const isPast = isSlotInPast(date, currentStartTime);
        const isBooked = bookedSlots.has(slotKey);
        const isAfterRequest = !requestedStartTime || currentStartTime > requestedStartTime;

        if (!isPast && !isBooked && isAfterRequest) {
          const slotInfo = {
            startTime: currentStartTime,
            endTime: currentEndTime
          };
          generatedSlots.push(slotInfo);
          if (returnSingleSlot) return [slotInfo];
        }

        currentStartTime = addMinutesToTime(currentEndTime, bufferTime);
      }
    }
  } else if (schedulingType === 'WAVE') {
    for (const window of windows) {
      const bookedInWave = appointments.filter(
        a => a.startTime === window.startTime && a.endTime === window.endTime
      ).length;

      const isPast = isSlotInPast(date, window.startTime);
      const isAfterRequest = !requestedStartTime || window.startTime > requestedStartTime;

      if (!isPast && bookedInWave < waveCapacity && isAfterRequest) {
        const slotInfo = {
          timeWindow: `${window.startTime} - ${window.endTime}`,
          startTime: window.startTime,
          endTime: window.endTime,
          available: `${waveCapacity - bookedInWave}/${waveCapacity}`,
          availableCapacity: waveCapacity - bookedInWave,
          isFull: bookedInWave >= waveCapacity
        };
        generatedSlots.push(slotInfo);
        if (returnSingleSlot) return [slotInfo];
      }
    }
  }

  return generatedSlots;
}

/**
 * Helper to fetch all doctor availability and appointments in bulk
 * to prevent N+1 query problems inside next-available loops.
 */
async function fetchDoctorScheduleData(doctorId: string, startDate: Date, maxDaysAhead: number) {
  const maxDate = new Date(startDate);
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  const [recurring, custom, appointments] = await Promise.all([
    prisma.recurringAvailability.findMany({ where: { doctorId } }),
    prisma.customAvailability.findMany({
      where: { doctorId, date: { gte: startDate, lte: maxDate } }
    }),
    prisma.appointment.findMany({
      where: { doctorId, date: { gte: startDate, lte: maxDate }, status: 'SCHEDULED' }
    })
  ]);

  return { recurring, custom, appointments };
}

/**
 * findNextAvailableSlots
 * Replaces both findNextAvailableDaySlots and findNextAvailableSlot.
 * 
 * @param searchWindow Represents WORKING DAYS, not calendar days.
 */
export async function findNextAvailableSlots(
  doctorId: string,
  startDate: Date,
  options: {
    requestedStartTime?: string;
    returnSingleSlot?: boolean;
    currentAppointmentId?: string; // To ignore the appointment being rescheduled
  } = {}
): Promise<{ date: string; schedulingType: string; slots: any[] } | null> {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true }
  });
  if (!doctor || !doctor.doctorProfile) return null;

  const searchWindow = doctor.doctorProfile.searchWindow || 30;
  const maxCalendarDaysLimit = 365;

  // Batch fetch data
  const scheduleData = await fetchDoctorScheduleData(doctorId, startDate, maxCalendarDaysLimit);
  
  let currentDate = new Date(startDate);
  let workingDaysChecked = 0;

  for (let calendarDay = 0; calendarDay < maxCalendarDaysLimit; calendarDay++) {
    // 1. Resolve windows
    let windows: { startTime: string; endTime: string }[] = [];
    
    // Find custom availability for currentDate
    const currentCustom = scheduleData.custom.filter(
      c => c.date.getTime() === currentDate.getTime()
    );

    if (currentCustom.length > 0) {
      windows = currentCustom.sort((a, b) => a.startTime.localeCompare(b.startTime));
    } else {
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = dayNames[currentDate.getDay()];
      const currentRecurring = scheduleData.recurring.filter(r => r.dayOfWeek === dayOfWeek);
      windows = currentRecurring.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    const isWorkingDay = windows.length > 0;
    
    if (isWorkingDay) {
      workingDaysChecked++;

      let dayAppointments = scheduleData.appointments.filter(
        a => a.date.getTime() === currentDate.getTime()
      );
      
      if (options.currentAppointmentId) {
        dayAppointments = dayAppointments.filter(a => a.id !== options.currentAppointmentId);
      }

      // Check if this is the exact same date as requested (for after-time filtering)
      const isSameDate = currentDate.getTime() === startDate.getTime();
      const reqStartTime = isSameDate ? options.requestedStartTime : undefined;

      const generatedSlots = generateSlotsForDay(
        currentDate,
        windows,
        dayAppointments,
        doctor.doctorProfile,
        reqStartTime,
        options.returnSingleSlot
      );

      if (generatedSlots.length > 0) {
        return {
          date: currentDate.toISOString().split('T')[0],
          schedulingType: doctor.doctorProfile.schedulingType,
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
