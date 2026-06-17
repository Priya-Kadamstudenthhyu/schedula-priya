"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePatientProfileSchema = exports.patientProfileSchema = exports.updateDoctorProfileSchema = exports.doctorProfileSchema = void 0;
const zod_1 = require("zod");
exports.doctorProfileSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, "Full name must be at least 2 characters long"),
    specialization: zod_1.z.string().min(2, "Specialization must be provided"),
    experience: zod_1.z.number().int().min(0, "Experience must be a positive number"),
    qualification: zod_1.z.string().min(2, "Qualification must be provided"),
    consultationFee: zod_1.z.number().int().min(0, "Consultation fee must be a positive number"),
    availability: zod_1.z.string().min(2, "Availability must be provided"),
    slotDuration: zod_1.z.number().int().min(5).optional(),
    schedulingType: zod_1.z.enum(['STREAM', 'WAVE']).optional(),
    bufferTime: zod_1.z.number().int().min(0).optional(),
    waveCapacity: zod_1.z.number().int().min(1).optional()
});
exports.updateDoctorProfileSchema = exports.doctorProfileSchema.partial();
exports.patientProfileSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, "Full name must be at least 2 characters long"),
    age: zod_1.z.number().int().min(0, "Age must be a valid positive number"),
    gender: zod_1.z.string().min(1, "Gender is required"),
    contactDetails: zod_1.z.string().min(5, "Contact details are required"),
    basicHealthInfo: zod_1.z.string().optional()
});
exports.updatePatientProfileSchema = exports.patientProfileSchema.partial();
