import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24hr format

export const bookAppointmentSchema = z.object({
  doctorId: z.string().uuid({ message: 'Valid doctorId is required' }),
  date: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'date must be a valid date string e.g. 2026-06-20',
  }),
  startTime: z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format e.g. 10:00'),
  endTime: z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format e.g. 10:15'),
}).refine(data => data.startTime < data.endTime, {
  message: 'startTime must be before endTime',
  path: ['endTime'],
});

export const rescheduleAppointmentSchema = z.object({
  date: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'date must be a valid date string e.g. 2026-06-20',
  }),
  startTime: z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format e.g. 10:00'),
  endTime: z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format e.g. 10:15'),
}).refine(data => data.startTime < data.endTime, {
  message: 'startTime must be before endTime',
  path: ['endTime'],
});
