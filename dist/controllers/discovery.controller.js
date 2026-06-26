"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDoctorById = exports.getDoctors = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getDoctors = async (req, res, next) => {
    try {
        // Parse query parameters
        let page = parseInt(req.query.page, 10);
        let limit = parseInt(req.query.limit, 10);
        const search = req.query.search;
        const specialization = req.query.specialization;
        const availability = req.query.availability;
        // Handle invalid pagination (fallback to defaults if NaN or negative)
        if (isNaN(page) || page <= 0)
            page = 1;
        if (isNaN(limit) || limit <= 0)
            limit = 10;
        const skip = (page - 1) * limit;
        // Build the dynamic WHERE clause
        const whereClause = {};
        if (search) {
            whereClause.fullName = {
                contains: search,
                mode: 'insensitive' // case-insensitive partial match
            };
        }
        if (specialization) {
            whereClause.specialization = {
                equals: specialization,
                mode: 'insensitive' // case-insensitive exact match
            };
        }
        if (availability === 'true') {
            whereClause.isAvailable = true;
        }
        else if (availability === 'false') {
            whereClause.isAvailable = false;
        }
        // Execute queries in parallel
        const [doctors, total] = await Promise.all([
            prisma_1.default.doctorProfile.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma_1.default.doctorProfile.count({
                where: whereClause
            })
        ]);
        // Return 200 with data (empty array is perfectly fine if no doctors found)
        res.status(200).json({
            success: true,
            data: doctors,
            metadata: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDoctors = getDoctors;
const getDoctorById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const doctor = await prisma_1.default.doctorProfile.findUnique({
            where: { id: String(id) }
        });
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found.' });
        }
        res.status(200).json({ success: true, data: doctor });
    }
    catch (error) {
        next(error);
    }
};
exports.getDoctorById = getDoctorById;
