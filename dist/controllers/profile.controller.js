"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePatientProfile = exports.getPatientProfile = exports.createPatientProfile = exports.updateDoctorProfile = exports.getDoctorProfile = exports.createDoctorProfile = void 0;
const profile_validator_1 = require("../validators/profile.validator");
const prisma_1 = __importDefault(require("../lib/prisma"));
// =======================
// DOCTOR PROFILE HANDLERS
// =======================
const createDoctorProfile = async (req, res, next) => {
    try {
        const user = req.user;
        // 1. Validate payload
        const validatedData = profile_validator_1.doctorProfileSchema.parse(req.body);
        // 2. Prevent duplicate profiles
        const existingProfile = await prisma_1.default.doctorProfile.findUnique({
            where: { userId: user.id }
        });
        if (existingProfile) {
            return res.status(400).json({ success: false, message: 'Doctor profile already exists for this user.' });
        }
        // 3. Create profile
        const profile = await prisma_1.default.doctorProfile.create({
            data: {
                ...validatedData,
                userId: user.id
            }
        });
        res.status(201).json({ success: true, message: 'Doctor profile created successfully', data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.createDoctorProfile = createDoctorProfile;
const getDoctorProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const profile = await prisma_1.default.doctorProfile.findUnique({
            where: { userId: user.id }
        });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Doctor profile not found. Please complete onboarding.' });
        }
        res.status(200).json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.getDoctorProfile = getDoctorProfile;
const updateDoctorProfile = async (req, res, next) => {
    try {
        const user = req.user;
        // 1. Validate partial payload
        const validatedData = profile_validator_1.updateDoctorProfileSchema.parse(req.body);
        // 2. Ensure profile exists
        const profile = await prisma_1.default.doctorProfile.findUnique({
            where: { userId: user.id }
        });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
        }
        // 3. Update profile
        const updatedProfile = await prisma_1.default.doctorProfile.update({
            where: { userId: user.id },
            data: validatedData
        });
        res.status(200).json({ success: true, message: 'Doctor profile updated successfully', data: updatedProfile });
    }
    catch (error) {
        next(error);
    }
};
exports.updateDoctorProfile = updateDoctorProfile;
// ========================
// PATIENT PROFILE HANDLERS
// ========================
const createPatientProfile = async (req, res, next) => {
    try {
        const user = req.user;
        // 1. Validate payload
        const validatedData = profile_validator_1.patientProfileSchema.parse(req.body);
        // 2. Prevent duplicate profiles
        const existingProfile = await prisma_1.default.patientProfile.findUnique({
            where: { userId: user.id }
        });
        if (existingProfile) {
            return res.status(400).json({ success: false, message: 'Patient profile already exists for this user.' });
        }
        // 3. Create profile
        const profile = await prisma_1.default.patientProfile.create({
            data: {
                ...validatedData,
                userId: user.id
            }
        });
        res.status(201).json({ success: true, message: 'Patient profile created successfully', data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.createPatientProfile = createPatientProfile;
const getPatientProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const profile = await prisma_1.default.patientProfile.findUnique({
            where: { userId: user.id }
        });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Patient profile not found. Please complete onboarding.' });
        }
        res.status(200).json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.getPatientProfile = getPatientProfile;
const updatePatientProfile = async (req, res, next) => {
    try {
        const user = req.user;
        // 1. Validate partial payload
        const validatedData = profile_validator_1.updatePatientProfileSchema.parse(req.body);
        // 2. Ensure profile exists
        const profile = await prisma_1.default.patientProfile.findUnique({
            where: { userId: user.id }
        });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Patient profile not found.' });
        }
        // 3. Update profile
        const updatedProfile = await prisma_1.default.patientProfile.update({
            where: { userId: user.id },
            data: validatedData
        });
        res.status(200).json({ success: true, message: 'Patient profile updated successfully', data: updatedProfile });
    }
    catch (error) {
        next(error);
    }
};
exports.updatePatientProfile = updatePatientProfile;
