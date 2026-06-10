"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRole = void 0;
// Role Guard (similar to NestJS Guards)
const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !allowedRoles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: You do not have the required role to access this route. Expected one of: [${allowedRoles.join(', ')}]`
            });
        }
        next();
    };
};
exports.authorizeRole = authorizeRole;
