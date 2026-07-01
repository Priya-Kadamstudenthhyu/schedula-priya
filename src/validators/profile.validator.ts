import { z } from 'zod';

export const doctorProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
  specialization: z.string().min(2, "Specialization must be provided"),
  experience: z.number().int().min(0, "Experience must be a positive number"),
  qualification: z.string().min(2, "Qualification must be provided"),
  consultationFee: z.number().int().min(0, "Consultation fee must be a positive number"),
  availability: z.string().min(2, "Availability must be provided"),
  slotDuration: z.number().int().min(5).optional(),
  schedulingType: z.enum(['STREAM', 'WAVE']).optional(),
  bufferTime: z.number().int().min(0).optional(),
  waveCapacity: z.number().int().min(1).optional(),
  allowFutureBooking: z.boolean().optional(),
  maxFutureBookingDays: z.number().int().min(1, "maxFutureBookingDays must be at least 1").nullable().optional()
});

export const updateDoctorProfileSchema = doctorProfileSchema.partial();

export const patientProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
  age: z.number().int().min(0, "Age must be a valid positive number"),
  gender: z.string().min(1, "Gender is required"),
  contactDetails: z.string().min(5, "Contact details are required"),
  basicHealthInfo: z.string().optional()
});

export const updatePatientProfileSchema = patientProfileSchema.partial();
