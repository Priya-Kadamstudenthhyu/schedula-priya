import { Request, Response, NextFunction } from 'express';

// Role Guard (similar to NestJS Guards)
export const authorizeRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have the required role to access this route. Expected one of: [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
};
