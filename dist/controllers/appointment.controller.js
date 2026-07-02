"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorCancelAppointment = exports.getDoctorAppointments = exports.rescheduleAppointment = exports.cancelAppointment = exports.getPatientAppointments = exports.bookAppointment = void 0;
const appointment_validator_1 = require("../validators/appointment.validator");
const prisma_1 = __importDefault(require("../lib/prisma"));
const slot_service_1 = require("../services/slot.service");
const notification_service_1 = require("../services/notification.service");
// Helper to get the local Date object for the appointment start time
function getAppointmentStartDateTime(date, startTime) {
    const apptDate = new Date(date);
    const [hours, mins] = startTime.split(':').map(Number);
    return new Date(apptDate.getUTCFullYear(), apptDate.getUTCMonth(), apptDate.getUTCDate(), hours, mins, 0, 0);
}
// Wrapper around the shared slot service for providing single slot suggestions
async function findNextAvailableSlot(doctorId, requestedDate, requestedStartTime, currentAppointmentId) {
    const suggestedSlot = await (0, slot_service_1.findNextAvailableSlots)(doctorId, requestedDate, {
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
const bookAppointment = async (req, res, next) => {
    try {
        const patientId = req.user.id;
        const parsed = appointment_validator_1.bookAppointmentSchema.parse(req.body);
        // Verify patient profile/user exists
        const patient = await prisma_1.default.user.findUnique({
            where: { id: patientId }
        });
        if (!patient || patient.role !== 'PATIENT') {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }
        const parsedDate = new Date(parsed.date);
        parsedDate.setUTCHours(0, 0, 0, 0);
        // 1. Reject past dates immediately (before any DB queries)
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (parsedDate.getTime() < today.getTime()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot book an appointment in the past.'
            });
        }
        // 2. Check if Doctor exists
        const doctor = await prisma_1.default.user.findUnique({
            where: { id: parsed.doctorId },
            include: { doctorProfile: true }
        });
        if (!doctor || doctor.role !== 'DOCTOR') {
            return res.status(404).json({ success: false, message: 'Doctor not found.' });
        }
        // 3. Doctor future booking configuration check
        const allowFutureBooking = doctor.doctorProfile?.allowFutureBooking ?? false;
        const maxFutureBookingDays = doctor.doctorProfile?.maxFutureBookingDays ?? null;
        const isToday = parsedDate.getTime() === today.getTime();
        if (!isToday) {
            // Future date requested
            if (!allowFutureBooking) {
                return res.status(400).json({
                    success: false,
                    message: 'This doctor only accepts same-day bookings. Please book for today.'
                });
            }
            const maxDays = (maxFutureBookingDays !== null && maxFutureBookingDays !== undefined)
                ? maxFutureBookingDays
                : 7; // Default 7 days
            const maxAllowedDate = new Date(today);
            maxAllowedDate.setUTCDate(today.getUTCDate() + maxDays);
            if (parsedDate.getTime() > maxAllowedDate.getTime()) {
                // Format maxAllowedDate as YYYY-MM-DD
                const yyyy = maxAllowedDate.getUTCFullYear();
                const mm = String(maxAllowedDate.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(maxAllowedDate.getUTCDate()).padStart(2, '0');
                const lastAllowedStr = `${yyyy}-${mm}-${dd}`;
                return res.status(400).json({
                    success: false,
                    message: `Booking is only allowed up to ${maxDays} day(s) in advance. Last allowed date is ${lastAllowedStr}.`
                });
            }
        }
        // 4. Determine current request local time (timezone-aware) — only needed for TODAY's booking window check
        if (isToday) {
            const now = new Date();
            let currentHours = now.getHours();
            let currentMins = now.getMinutes();
            const timezoneOffsetHeader = req.headers['x-timezone-offset'] || req.headers['timezone-offset'];
            if (timezoneOffsetHeader) {
                const offsetMinutes = parseInt(timezoneOffsetHeader, 10);
                if (!isNaN(offsetMinutes)) {
                    const localTime = new Date(now.getTime() - offsetMinutes * 60 * 1000);
                    currentHours = localTime.getUTCHours();
                    currentMins = localTime.getUTCMinutes();
                }
            }
            else {
                // Fallback: Use IST (Asia/Kolkata) when no header is provided
                try {
                    const options = {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    };
                    const formatter = new Intl.DateTimeFormat('en-US', options);
                    const parts = formatter.formatToParts(now);
                    const hPart = parts.find(p => p.type === 'hour');
                    const mPart = parts.find(p => p.type === 'minute');
                    if (hPart && mPart) {
                        currentHours = parseInt(hPart.value, 10);
                        currentMins = parseInt(mPart.value, 10);
                    }
                }
                catch (err) {
                    currentHours = now.getHours();
                    currentMins = now.getMinutes();
                }
            }
            const currentMinutesFromMidnight = currentHours * 60 + currentMins;
            // Validate slot is not in the past within today
            const [slotHours, slotMins] = parsed.startTime.split(':').map(Number);
            const slotTotalMinutes = slotHours * 60 + slotMins;
            if (currentMinutesFromMidnight > slotTotalMinutes) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot book an appointment in the past.'
                });
            }
        }
        // 2.5 Check if doctor is on leave on this date
        const leaveRecord = await prisma_1.default.doctorLeave.findFirst({
            where: { doctorId: parsed.doctorId, date: parsedDate }
        });
        if (leaveRecord) {
            return res.status(400).json({
                success: false,
                message: 'Doctor is on leave on this date. Please select another available date.'
            });
        }
        // 3. Resolve Availability (Custom Override > Recurring)
        const schedulingType = doctor.doctorProfile?.schedulingType || 'STREAM';
        const slotDuration = doctor.doctorProfile?.slotDuration || 15;
        const bufferTime = doctor.doctorProfile?.bufferTime || 0;
        const waveCapacity = doctor.doctorProfile?.waveCapacity || 5;
        let availableWindows = [];
        const customAvailability = await prisma_1.default.customAvailability.findMany({
            where: { doctorId: parsed.doctorId, date: parsedDate },
            orderBy: { startTime: 'asc' },
        });
        if (customAvailability.length > 0) {
            availableWindows = customAvailability;
        }
        else {
            const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const dayOfWeek = dayNames[parsedDate.getDay()];
            const recurringAvailability = await prisma_1.default.recurringAvailability.findMany({
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
        // ════════════════════════════════════════════════════════════
        // BOOKING WINDOW VALIDATION (Day 19) — today only
        // ════════════════════════════════════════════════════════════
        if (isToday && availableWindows.length > 0) {
            let minStartMinutes = 24 * 60;
            let maxEndMinutes = 0;
            let minStartStr = '';
            let maxEndStr = '';
            for (const window of availableWindows) {
                const [sH, sM] = window.startTime.split(':').map(Number);
                const [eH, eM] = window.endTime.split(':').map(Number);
                const startMins = sH * 60 + sM;
                const endMins = eH * 60 + eM;
                if (startMins < minStartMinutes) {
                    minStartMinutes = startMins;
                    minStartStr = window.startTime;
                }
                if (endMins > maxEndMinutes) {
                    maxEndMinutes = endMins;
                    maxEndStr = window.endTime;
                }
            }
            if (minStartMinutes < maxEndMinutes) {
                const bookingWindowOpenMinutes = minStartMinutes - 120;
                const bookingWindowCloseMinutes = maxEndMinutes - 60;
                const formatMinutesTo12h = (totalMinutes) => {
                    let m = totalMinutes < 0 ? totalMinutes + 1440 : totalMinutes % 1440;
                    const h = Math.floor(m / 60);
                    const min = m % 60;
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const dh = (h % 12 === 0 ? 12 : h % 12).toString().padStart(2, '0');
                    const dm = min < 10 ? `0${min}` : min;
                    return `${dh}:${dm} ${ampm}`;
                };
                // Get current local time in minutes (same IST logic, re-derived here)
                const nowW = new Date();
                let curH = nowW.getHours();
                let curM = nowW.getMinutes();
                const tzHdr = req.headers['x-timezone-offset'] || req.headers['timezone-offset'];
                if (tzHdr) {
                    const off = parseInt(tzHdr, 10);
                    if (!isNaN(off)) {
                        const lt = new Date(nowW.getTime() - off * 60 * 1000);
                        curH = lt.getUTCHours();
                        curM = lt.getUTCMinutes();
                    }
                }
                else {
                    try {
                        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
                        const parts = fmt.formatToParts(nowW);
                        const hp = parts.find(p => p.type === 'hour');
                        const mp = parts.find(p => p.type === 'minute');
                        if (hp && mp) {
                            curH = parseInt(hp.value, 10);
                            curM = parseInt(mp.value, 10);
                        }
                    }
                    catch { /* fallback to system time */ }
                }
                const curMins = curH * 60 + curM;
                if (curMins < bookingWindowOpenMinutes) {
                    return res.status(400).json({
                        success: false,
                        message: `Booking has not opened yet. For today's schedule (${minStartStr} - ${maxEndStr}), booking opens at ${formatMinutesTo12h(bookingWindowOpenMinutes)}.`
                    });
                }
                if (curMins > bookingWindowCloseMinutes) {
                    return res.status(400).json({
                        success: false,
                        message: `Booking has closed for today. Booking closed at ${formatMinutesTo12h(bookingWindowCloseMinutes)}.`
                    });
                }
            }
        }
        let assignedToken = null;
        if (schedulingType === 'STREAM') {
            // Stream Scheduling Validation
            let isValidSlot = false;
            for (const window of availableWindows) {
                let currentStartTime = window.startTime;
                while (currentStartTime < window.endTime) {
                    const currentEndTime = (0, slot_service_1.addMinutesToTime)(currentStartTime, slotDuration);
                    if (currentEndTime > window.endTime)
                        break;
                    if (currentStartTime === parsed.startTime && currentEndTime === parsed.endTime) {
                        isValidSlot = true;
                        break;
                    }
                    currentStartTime = (0, slot_service_1.addMinutesToTime)(currentEndTime, bufferTime);
                }
                if (isValidSlot)
                    break;
            }
            if (!isValidSlot) {
                const suggestedSlot = await findNextAvailableSlot(parsed.doctorId, parsedDate, parsed.startTime);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid slot. This slot is not offered by the doctor.',
                    suggestedSlot
                });
            }
            const existingAppointment = await prisma_1.default.appointment.findFirst({
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
        }
        else if (schedulingType === 'WAVE') {
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
            const existingAppointmentsInWave = await prisma_1.default.appointment.count({
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
        const appointment = await prisma_1.default.appointment.create({
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
        const formattedDate = notification_service_1.notificationService.formatDate(parsedDate);
        const formattedTime = notification_service_1.notificationService.formatTime(parsed.startTime);
        const notificationMessage = `Your appointment with ${doctorDisplayName} has been booked successfully for ${formattedDate} at ${formattedTime}.`;
        await notification_service_1.notificationService.create({
            patientId,
            title: 'Appointment Booked',
            message: notificationMessage,
            type: 'APPOINTMENT_BOOKED'
        });
        res.status(201).json({ success: true, message: 'Appointment booked successfully.', data: appointment });
    }
    catch (error) {
        next(error);
    }
};
exports.bookAppointment = bookAppointment;
// GET /api/appointment/my
const getPatientAppointments = async (req, res, next) => {
    try {
        const patientId = req.user.id;
        const appointments = await prisma_1.default.appointment.findMany({
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
    }
    catch (error) {
        next(error);
    }
};
exports.getPatientAppointments = getPatientAppointments;
// PATCH /api/appointment/:id/cancel
const cancelAppointment = async (req, res, next) => {
    try {
        const patientId = req.user.id;
        const id = req.params.id;
        // Verify patient profile/user exists
        const patient = await prisma_1.default.user.findUnique({
            where: { id: patientId }
        });
        if (!patient || patient.role !== 'PATIENT') {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }
        const appointment = await prisma_1.default.appointment.findUnique({
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
        const cancelledAppointment = await prisma_1.default.appointment.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
        // Notify patient about cancellation
        const formattedDate = notification_service_1.notificationService.formatDate(appointment.date);
        const formattedTime = notification_service_1.notificationService.formatTime(appointment.startTime);
        const notificationMessage = `Your appointment scheduled on ${formattedDate} at ${formattedTime} has been cancelled.`;
        await notification_service_1.notificationService.create({
            patientId: appointment.patientId,
            title: 'Appointment Cancelled',
            message: notificationMessage,
            type: 'APPOINTMENT_CANCELLED'
        });
        res.status(200).json({ success: true, message: 'Appointment cancelled successfully.', data: cancelledAppointment });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelAppointment = cancelAppointment;
// PATCH /api/appointment/:id/reschedule
const rescheduleAppointment = async (req, res, next) => {
    const id = req.params.id;
    try {
        const patientId = req.user.id;
        // Verify patient profile/user exists
        const patient = await prisma_1.default.user.findUnique({
            where: { id: patientId }
        });
        if (!patient || patient.role !== 'PATIENT') {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }
        // 1. Validate body schema
        const parsed = appointment_validator_1.rescheduleAppointmentSchema.parse(req.body);
        const parsedDate = new Date(parsed.date);
        parsedDate.setUTCHours(0, 0, 0, 0);
        // 2. Fetch the existing appointment
        const appointment = await prisma_1.default.appointment.findUnique({
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
        const isSameSlot = appointment.date.getTime() === parsedDate.getTime() &&
            appointment.startTime === parsed.startTime &&
            appointment.endTime === parsed.endTime;
        if (isSameSlot) {
            return res.status(400).json({ success: false, message: 'Cannot reschedule to the same slot and time.' });
        }
        // 7. Validate if new slot is in the past
        if ((0, slot_service_1.isSlotInPast)(parsedDate, parsed.startTime)) {
            return res.status(400).json({ success: false, message: 'Cannot reschedule to a past date/time.' });
        }
        // 8. Fetch the doctor and their profile
        const doctor = await prisma_1.default.user.findUnique({
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
        let availableWindows = [];
        const customAvailability = await prisma_1.default.customAvailability.findMany({
            where: { doctorId: appointment.doctorId, date: parsedDate },
            orderBy: { startTime: 'asc' },
        });
        if (customAvailability.length > 0) {
            availableWindows = customAvailability;
        }
        else {
            const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const dayOfWeek = dayNames[parsedDate.getDay()];
            const recurringAvailability = await prisma_1.default.recurringAvailability.findMany({
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
        let assignedToken = null;
        if (schedulingType === 'STREAM') {
            // Stream Scheduling Validation
            let isValidSlot = false;
            for (const window of availableWindows) {
                let currentStartTime = window.startTime;
                while (currentStartTime < window.endTime) {
                    const currentEndTime = (0, slot_service_1.addMinutesToTime)(currentStartTime, slotDuration);
                    if (currentEndTime > window.endTime)
                        break;
                    if (currentStartTime === parsed.startTime && currentEndTime === parsed.endTime) {
                        isValidSlot = true;
                        break;
                    }
                    currentStartTime = (0, slot_service_1.addMinutesToTime)(currentEndTime, bufferTime);
                }
                if (isValidSlot)
                    break;
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
            const existingAppointment = await prisma_1.default.appointment.findFirst({
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
        }
        else if (schedulingType === 'WAVE') {
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
            const existingAppointmentsInWave = await prisma_1.default.appointment.count({
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
        const updatedAppointment = await prisma_1.default.$transaction(async (tx) => {
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
            }
            else if (schedulingType === 'WAVE') {
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
        const formattedDate = notification_service_1.notificationService.formatDate(parsedDate);
        const formattedTime = notification_service_1.notificationService.formatTime(parsed.startTime);
        const notificationMessage = `Your appointment has been rescheduled to ${formattedDate} at ${formattedTime}.`;
        await notification_service_1.notificationService.create({
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
    }
    catch (error) {
        if (error.message === 'SLOT_BOOKED' || error.message === 'WAVE_FULL') {
            try {
                const appt = await prisma_1.default.appointment.findUnique({ where: { id } });
                if (appt) {
                    const parsedDate = new Date(req.body.date);
                    parsedDate.setUTCHours(0, 0, 0, 0);
                    const suggestedSlot = await findNextAvailableSlot(appt.doctorId, parsedDate, req.body.startTime, appt.id);
                    return res.status(409).json({
                        success: false,
                        message: error.message === 'SLOT_BOOKED' ? 'This exact slot is already booked.' : 'This wave window is completely full.',
                        suggestedSlot
                    });
                }
            }
            catch (innerErr) {
                return next(innerErr);
            }
        }
        next(error);
    }
};
exports.rescheduleAppointment = rescheduleAppointment;
// ════════════════════════════════════════════════════════════
// DOCTOR APPOINTMENT VIEW
// ════════════════════════════════════════════════════════════
// GET /api/doctor/appointments
const getDoctorAppointments = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const { date } = req.query;
        let dateFilter;
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
        const appointments = await prisma_1.default.appointment.findMany({
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
    }
    catch (error) {
        next(error);
    }
};
exports.getDoctorAppointments = getDoctorAppointments;
// PATCH /api/doctor/appointments/:id/cancel
const doctorCancelAppointment = async (req, res, next) => {
    const id = req.params.id;
    try {
        const doctorId = req.user.id;
        // 1. Fetch the existing appointment
        const appointment = await prisma_1.default.appointment.findUnique({
            where: { id }
        });
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found.' });
        }
        // Verify patient profile/user exists
        const patient = await prisma_1.default.user.findUnique({
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
        const cancelledAppointment = await prisma_1.default.appointment.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
        // Notify patient about cancellation
        const formattedDate = notification_service_1.notificationService.formatDate(appointment.date);
        const formattedTime = notification_service_1.notificationService.formatTime(appointment.startTime);
        const notificationMessage = `Your appointment scheduled on ${formattedDate} at ${formattedTime} has been cancelled.`;
        await notification_service_1.notificationService.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.doctorCancelAppointment = doctorCancelAppointment;
