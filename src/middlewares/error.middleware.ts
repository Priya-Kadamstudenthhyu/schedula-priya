import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const issues = err.errors || err.issues || [];
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: issues.map((e: any) => ({ path: e.path.join('.'), message: e.message }))
    });
  }

  // Handle generic errors
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};
