"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLeave = exports.getLeaves = exports.createLeave = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const leaveSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
    reason: zod_1.z.string().optional()
});
const createLeave = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const parsed = leaveSchema.parse(req.body);
        const parsedDate = new Date(parsed.date);
        parsedDate.setUTCHours(0, 0, 0, 0);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (parsedDate.getTime() < today.getTime()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot create leave for a past date.'
            });
        }
        // Check for duplicate leave
        const existingLeave = await prisma_1.default.doctorLeave.findFirst({
            where: {
                doctorId,
                date: parsedDate
            }
        });
        if (existingLeave) {
            return res.status(409).json({
                success: false,
                message: 'Leave already exists for this date.'
            });
        }
        // Check if appointments already exist on that date
        const existingAppointments = await prisma_1.default.appointment.findFirst({
            where: {
                doctorId,
                date: parsedDate,
                status: {
                    not: 'CANCELLED'
                }
            }
        });
        if (existingAppointments) {
            return res.status(409).json({
                success: false,
                message: 'Cannot apply leave. Appointments are already scheduled on this date. Please cancel or reschedule existing appointments first.'
            });
        }
        const leave = await prisma_1.default.doctorLeave.create({
            data: {
                doctorId,
                date: parsedDate,
                reason: parsed.reason
            }
        });
        res.status(201).json({
            success: true,
            message: 'Leave created successfully.',
            data: leave
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createLeave = createLeave;
const getLeaves = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const leaves = await prisma_1.default.doctorLeave.findMany({
            where: { doctorId },
            orderBy: { date: 'asc' }
        });
        res.status(200).json({
            success: true,
            data: leaves
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getLeaves = getLeaves;
const deleteLeave = async (req, res, next) => {
    try {
        const doctorId = req.user.id;
        const id = req.params.id;
        const leave = await prisma_1.default.doctorLeave.findUnique({
            where: { id }
        });
        if (!leave || leave.doctorId !== doctorId) {
            return res.status(404).json({
                success: false,
                message: 'Leave not found.'
            });
        }
        await prisma_1.default.doctorLeave.delete({
            where: { id }
        });
        res.status(200).json({
            success: true,
            message: 'Leave deleted successfully.'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteLeave = deleteLeave;
