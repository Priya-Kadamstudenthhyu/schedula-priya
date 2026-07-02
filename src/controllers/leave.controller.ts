import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const leaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  reason: z.string().optional()
});

export const createLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = (req as any).user.id;
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
    const existingLeave = await prisma.doctorLeave.findFirst({
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
    const existingAppointments = await prisma.appointment.findFirst({
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

    const leave = await prisma.doctorLeave.create({
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
  } catch (error) {
    next(error);
  }
};

export const getLeaves = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = (req as any).user.id;
    
    const leaves = await prisma.doctorLeave.findMany({
      where: { doctorId },
      orderBy: { date: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = (req as any).user.id;
    const id = req.params.id as string;

    const leave = await prisma.doctorLeave.findUnique({
      where: { id }
    });

    if (!leave || leave.doctorId !== doctorId) {
      return res.status(404).json({
        success: false,
        message: 'Leave not found.'
      });
    }

    await prisma.doctorLeave.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Leave deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};
