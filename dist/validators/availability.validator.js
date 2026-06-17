"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customAvailabilitySchema = exports.updateRecurringAvailabilitySchema = exports.recurringAvailabilitySchema = void 0;
const zod_1 = require("zod");
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24hr format
const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
exports.recurringAvailabilitySchema = zod_1.z.object({
    dayOfWeek: zod_1.z.enum(validDays, { message: 'dayOfWeek must be a valid day e.g. MONDAY' }),
    startTime: zod_1.z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format e.g. 09:00'),
    endTime: zod_1.z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format e.g. 13:00'),
}).refine(data => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
});
exports.updateRecurringAvailabilitySchema = zod_1.z.object({
    startTime: zod_1.z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format e.g. 09:00').optional(),
    endTime: zod_1.z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format e.g. 13:00').optional(),
}).refine(data => {
    if (data.startTime && data.endTime)
        return data.startTime < data.endTime;
    return true;
}, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
});
exports.customAvailabilitySchema = zod_1.z.object({
    date: zod_1.z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'date must be a valid date string e.g. 2026-06-15',
    }),
    startTime: zod_1.z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format e.g. 14:00'),
    endTime: zod_1.z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format e.g. 16:00'),
}).refine(data => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
});
