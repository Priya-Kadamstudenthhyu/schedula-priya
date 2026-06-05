import { Request, Response } from 'express';

export const getDoctorProfile = async (req: Request, res: Response) => {
  // At this point, authMiddleware has verified the token and roleMiddleware has verified the DOCTOR role.
  const user = (req as any).user;

  res.status(200).json({
    success: true,
    message: 'Welcome to the Doctor Dashboard',
    data: {
      profile: 'Doctor Profile Info',
      user
    }
  });
};

export const getPatientProfile = async (req: Request, res: Response) => {
  // At this point, authMiddleware has verified the token and roleMiddleware has verified the PATIENT role.
  const user = (req as any).user;

  res.status(200).json({
    success: true,
    message: 'Welcome to the Patient Dashboard',
    data: {
      profile: 'Patient Profile Info',
      user
    }
  });
};
