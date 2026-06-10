import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const getDoctors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse query parameters
    let page = parseInt(req.query.page as string, 10);
    let limit = parseInt(req.query.limit as string, 10);
    const search = req.query.search as string;
    const specialization = req.query.specialization as string;
    const availability = req.query.availability as string;

    // Handle invalid pagination (fallback to defaults if NaN or negative)
    if (isNaN(page) || page <= 0) page = 1;
    if (isNaN(limit) || limit <= 0) limit = 10;

    const skip = (page - 1) * limit;

    // Build the dynamic WHERE clause
    const whereClause: Prisma.DoctorProfileWhereInput = {};

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
    } else if (availability === 'false') {
      whereClause.isAvailable = false;
    }

    // Execute queries in parallel
    const [doctors, total] = await Promise.all([
      prisma.doctorProfile.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.doctorProfile.count({
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

  } catch (error) {
    next(error);
  }
};

export const getDoctorById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: String(id) }
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    res.status(200).json({ success: true, data: doctor });
  } catch (error) {
    next(error);
  }
};
