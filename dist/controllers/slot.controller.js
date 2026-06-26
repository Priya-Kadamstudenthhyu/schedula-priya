"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableSlots = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const slot_service_1 = require("../services/slot.service");
const getAvailableSlots = async (req, res, next) => {
    try {
        const doctorId = req.params.doctorId;
        const { date } = req.query;
        if (!date || typeof date !== 'string') {
            return res.status(400).json({ success: false, message: 'Date query parameter is required (YYYY-MM-DD).' });
        }
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        parsedDate.setUTCHours(0, 0, 0, 0);
        // 1. Check if Doctor exists and get their profile
        const doctor = await prisma_1.default.user.findUnique({
            where: { id: doctorId },
            include: { doctorProfile: true },
        });
        if (!doctor || doctor.role !== 'DOCTOR' || !doctor.doctorProfile) {
            return res.status(404).json({ success: false, message: 'Doctor not found or has no profile.' });
        }
        const searchWindow = doctor.doctorProfile.searchWindow || 30;
        // 2. Fetch Appointments for that date
        const appointments = await prisma_1.default.appointment.findMany({
            where: {
                doctorId,
                date: parsedDate,
                status: 'SCHEDULED'
            }
        });
        // 3. Resolve Availability (Custom Override > Recurring)
        let availableWindows = [];
        const customAvailability = await prisma_1.default.customAvailability.findMany({
            where: { doctorId, date: parsedDate },
            orderBy: { startTime: 'asc' },
        });
        if (customAvailability.length > 0) {
            availableWindows = customAvailability;
        }
        else {
            const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const dayOfWeek = dayNames[parsedDate.getDay()];
            const recurringAvailability = await prisma_1.default.recurringAvailability.findMany({
                where: { doctorId, dayOfWeek },
                orderBy: { startTime: 'asc' },
            });
            availableWindows = recurringAvailability;
        }
        // 4. Generate Slots using the shared service
        const generatedSlots = (0, slot_service_1.generateSlotsForDay)(parsedDate, availableWindows, appointments, doctor.doctorProfile);
        // 5. Evaluate availability and trigger Next Available search if empty
        let slotsToReturn = generatedSlots;
        let nextAvailableDate = date.split('T')[0];
        let nextAvailableSearchExecuted = false;
        if (availableWindows.length === 0 || generatedSlots.length === 0) {
            nextAvailableSearchExecuted = true;
            // Pass the date after the requested date to start searching
            const nextDay = new Date(parsedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            const nextDayResult = await (0, slot_service_1.findNextAvailableSlots)(doctorId, nextDay);
            if (!nextDayResult) {
                return res.status(200).json({
                    success: true,
                    message: `Requested date is unavailable. No appointments available in the next ${searchWindow} working days. Please try again later.`,
                    slots: []
                });
            }
            nextAvailableDate = nextDayResult.date;
            slotsToReturn = nextDayResult.slots;
        }
        res.status(200).json({
            success: true,
            message: nextAvailableSearchExecuted
                ? `Requested date is unavailable. Showing next available date: ${nextAvailableDate}`
                : 'Available slots fetched successfully.',
            nextAvailableDate,
            schedulingType: doctor.doctorProfile.schedulingType,
            slots: slotsToReturn
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailableSlots = getAvailableSlots;
