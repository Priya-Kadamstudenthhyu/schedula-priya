"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailabilityByDate = exports.createCustomAvailability = exports.deleteRecurringAvailability = exports.updateRecurringAvailability = exports.getRecurringAvailability = exports.createRecurringAvailability = void 0;
const availability_validator_1 = require("../validators/availability.validator");
const prisma_1 = __importDefault(require("../lib/prisma"));
function isOverlapping(s1, e1, s2, e2) {
    return s1 < e2 && e1 > s2;
}
const createRecurringAvailability = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const parsed = availability_validator_1.recurringAvailabilitySchema.parse(req.body);
        // Validate: startTime must be before endTime
        if (parsed.startTime >= parsed.endTime) {
            return res.status(400).json({ success: false, message: 'startTime must be before endTime.' });
        }
        // Check for overlapping slots on the same day
        const existing = await prisma_1.default.recurringAvailability.findMany({
            where: { doctorId, dayOfWeek: parsed.dayOfWeek },
        });
        const conflict = existing.find(slot => isOverlapping(parsed.startTime, parsed.endTime, slot.startTime, slot.endTime));
        if (conflict) {
            return res.status(409).json({
                success: false,
                message: `Overlapping time slot detected on ${parsed.dayOfWeek}. Existing: ${conflict.startTime} – ${conflict.endTime}`,
            });
        }
        // Check for exact duplicate
        const duplicate = existing.find(slot => slot.startTime === parsed.startTime && slot.endTime === parsed.endTime);
        if (duplicate) {
            return res.status(409).json({ success: false, message: 'This exact time slot already exists.' });
        }
        const slot = await prisma_1.default.recurringAvailability.create({
            data: { doctorId, ...parsed },
        });
        res.status(201).json({ success: true, message: 'Recurring availability created.', data: slot });
    }
    catch (error) {
        next(error);
    }
};
exports.createRecurringAvailability = createRecurringAvailability;
// GET /doctor/availability
const getRecurringAvailability = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const slots = await prisma_1.default.recurringAvailability.findMany({
            where: { doctorId },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
        res.status(200).json({ success: true, data: slots });
    }
    catch (error) {
        next(error);
    }
};
exports.getRecurringAvailability = getRecurringAvailability;
// PATCH /doctor/availability/:id
const updateRecurringAvailability = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const id = req.params.id;
        const parsed = availability_validator_1.updateRecurringAvailabilitySchema.parse(req.body);
        // Find the slot and verify ownership
        const slot = await prisma_1.default.recurringAvailability.findUnique({ where: { id } });
        if (!slot)
            return res.status(404).json({ success: false, message: 'Availability slot not found.' });
        if (slot.doctorId !== doctorId)
            return res.status(403).json({ success: false, message: 'Access denied.' });
        const newStart = parsed.startTime ?? slot.startTime;
        const newEnd = parsed.endTime ?? slot.endTime;
        if (newStart >= newEnd) {
            return res.status(400).json({ success: false, message: 'startTime must be before endTime.' });
        }
        // Check overlaps with other slots (excluding self)
        const others = await prisma_1.default.recurringAvailability.findMany({
            where: { doctorId, dayOfWeek: slot.dayOfWeek, NOT: { id } },
        });
        const conflict = others.find(s => isOverlapping(newStart, newEnd, s.startTime, s.endTime));
        if (conflict) {
            return res.status(409).json({
                success: false,
                message: `Overlapping time slot: ${conflict.startTime} – ${conflict.endTime}`,
            });
        }
        const updated = await prisma_1.default.recurringAvailability.update({
            where: { id },
            data: { startTime: newStart, endTime: newEnd },
        });
        res.status(200).json({ success: true, message: 'Availability updated.', data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.updateRecurringAvailability = updateRecurringAvailability;
// DELETE /doctor/availability/:id
const deleteRecurringAvailability = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const id = req.params.id;
        const slot = await prisma_1.default.recurringAvailability.findUnique({ where: { id } });
        if (!slot)
            return res.status(404).json({ success: false, message: 'Availability slot not found.' });
        if (slot.doctorId !== doctorId)
            return res.status(403).json({ success: false, message: 'Access denied.' });
        await prisma_1.default.recurringAvailability.delete({ where: { id } });
        res.status(200).json({ success: true, message: 'Availability slot deleted.' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteRecurringAvailability = deleteRecurringAvailability;
// ════════════════════════════════════════════════════════════
// CUSTOM DATE OVERRIDE AVAILABILITY
// ════════════════════════════════════════════════════════════
// POST /doctor/availability/override
const createCustomAvailability = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const parsed = availability_validator_1.customAvailabilitySchema.parse(req.body);
        const date = new Date(parsed.date);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        // Normalize date to midnight UTC for consistent comparison
        date.setUTCHours(0, 0, 0, 0);
        // Check overlaps for the same date
        const existing = await prisma_1.default.customAvailability.findMany({
            where: { doctorId, date },
        });
        const conflict = existing.find(s => isOverlapping(parsed.startTime, parsed.endTime, s.startTime, s.endTime));
        if (conflict) {
            return res.status(409).json({
                success: false,
                message: `Overlapping custom slot on ${parsed.date}: ${conflict.startTime} – ${conflict.endTime}`,
            });
        }
        const slot = await prisma_1.default.customAvailability.create({
            data: { doctorId, date, startTime: parsed.startTime, endTime: parsed.endTime },
        });
        res.status(201).json({ success: true, message: 'Custom availability override created.', data: slot });
    }
    catch (error) {
        next(error);
    }
};
exports.createCustomAvailability = createCustomAvailability;
// GET /doctor/availability/date?date=2026-06-15
const getAvailabilityByDate = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const { date } = req.query;
        if (!date || typeof date !== 'string') {
            return res.status(400).json({ success: false, message: 'Query param "date" is required. e.g. ?date=2026-06-15' });
        }
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        parsedDate.setUTCHours(0, 0, 0, 0);
        // 1. Check custom overrides first
        const customSlots = await prisma_1.default.customAvailability.findMany({
            where: { doctorId, date: parsedDate },
            orderBy: { startTime: 'asc' },
        });
        if (customSlots.length > 0) {
            return res.status(200).json({
                success: true,
                source: 'custom_override',
                date,
                data: customSlots,
            });
        }
        // 2. Fallback: get recurring availability for that day of week
        const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const dayOfWeek = dayNames[parsedDate.getDay()];
        const recurringSlots = await prisma_1.default.recurringAvailability.findMany({
            where: { doctorId, dayOfWeek },
            orderBy: { startTime: 'asc' },
        });
        if (recurringSlots.length === 0) {
            return res.status(200).json({
                success: true,
                source: 'recurring',
                date,
                message: `No availability set for ${dayOfWeek}`,
                data: [],
            });
        }
        res.status(200).json({
            success: true,
            source: 'recurring',
            date,
            dayOfWeek,
            data: recurringSlots,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailabilityByDate = getAvailabilityByDate;
