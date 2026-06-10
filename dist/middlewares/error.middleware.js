"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const errorHandler = (err, req, res, next) => {
    console.error(err);
    // Handle Zod validation errors
    if (err instanceof zod_1.ZodError) {
        const errorObj = err;
        const issues = errorObj.errors || errorObj.issues || [];
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: issues.map((e) => ({ path: e.path.join('.'), message: e.message }))
        });
    }
    // Handle generic errors
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};
exports.errorHandler = errorHandler;
