import { Request, Response, NextFunction } from 'express';
import {
  doctorProfileSchema,
  updateDoctorProfileSchema,
  patientProfileSchema,
  updatePatientProfileSchema
} from '../validators/profile.validator';
import prisma from '../lib/prisma';

// =======================
// DOCTOR PROFILE HANDLERS
// =======================

export const createDoctorProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    // 1. Validate payload
    const validatedData = doctorProfileSchema.parse(req.body);

    // 2. Prevent duplicate profiles
    const existingProfile = await prisma.doctorProfile.findUnique({
      where: { userId: user.id }
    });

    if (existingProfile) {
      return res.status(400).json({ success: false, message: 'Doctor profile already exists for this user.' });
    }

    // 3. Create profile
    const profile = await prisma.doctorProfile.create({
      data: {
        ...validatedData,
        userId: user.id
      }
    });

    res.status(201).json({ success: true, message: 'Doctor profile created successfully', data: profile });
  } catch (error) {
    next(error);
  }
};

export const getDoctorProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: user.id }
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found. Please complete onboarding.' });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateDoctorProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    // 1. Validate partial payload
    const validatedData = updateDoctorProfileSchema.parse(req.body);

    // 2. Ensure profile exists
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: user.id }
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    }

    // 3. Update profile
    const updatedProfile = await prisma.doctorProfile.update({
      where: { userId: user.id },
      data: validatedData
    });

    res.status(200).json({ success: true, message: 'Doctor profile updated successfully', data: updatedProfile });
  } catch (error) {
    next(error);
  }
};

// ========================
// PATIENT PROFILE HANDLERS
// ========================

export const createPatientProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    // 1. Validate payload
    const validatedData = patientProfileSchema.parse(req.body);

    // 2. Prevent duplicate profiles
    const existingProfile = await prisma.patientProfile.findUnique({
      where: { userId: user.id }
    });

    if (existingProfile) {
      return res.status(400).json({ success: false, message: 'Patient profile already exists for this user.' });
    }

    // 3. Create profile
    const profile = await prisma.patientProfile.create({
      data: {
        ...validatedData,
        userId: user.id
      }
    });

    res.status(201).json({ success: true, message: 'Patient profile created successfully', data: profile });
  } catch (error) {
    next(error);
  }
};

export const getPatientProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id }
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Patient profile not found. Please complete onboarding.' });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const updatePatientProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    // 1. Validate partial payload
    const validatedData = updatePatientProfileSchema.parse(req.body);

    // 2. Ensure profile exists
    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id }
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    // 3. Update profile
    const updatedProfile = await prisma.patientProfile.update({
      where: { userId: user.id },
      data: validatedData
    });

    res.status(200).json({ success: true, message: 'Patient profile updated successfully', data: updatedProfile });
  } catch (error) {
    next(error);
  }
};
