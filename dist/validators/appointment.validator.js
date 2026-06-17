"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescheduleAppointmentSchema = exports.bookAppointmentSchema = void 0;
const zod_1 = require("zod");
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24hr format
exports.bookAppointmentSchema = zod_1.z.object({
    doctorId: zod_1.z.string().uuid({ message: 'Valid doctorId is required' }),
    date: zod_1.z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'date must be a valid date string e.g. 2026-06-20',
    }),
    startTime: zod_1.z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format e.g. 10:00'),
    endTime: zod_1.z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format e.g. 10:15'),
}).refine(data => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
});
exports.rescheduleAppointmentSchema = zod_1.z.object({
    date: zod_1.z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'date must be a valid date string e.g. 2026-06-20',
    }),
    startTime: zod_1.z.string().regex(TIME_REGEX, 'startTime must be in HH:MM format e.g. 10:00'),
    endTime: zod_1.z.string().regex(TIME_REGEX, 'endTime must be in HH:MM format e.g. 10:15'),
}).refine(data => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
});
