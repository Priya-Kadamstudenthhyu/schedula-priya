"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.signup = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_validator_1 = require("../validators/auth.validator");
const prisma_1 = __importDefault(require("../lib/prisma"));
const signup = async (req, res, next) => {
    try {
        // 1. Validate payload
        const validatedData = auth_validator_1.signupSchema.parse(req.body);
        // 2. Check if user already exists
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email: validatedData.email }
        });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        // 3. Hash password
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(validatedData.password, salt);
        // 4. Create user
        const user = await prisma_1.default.user.create({
            data: {
                name: validatedData.name,
                email: validatedData.email,
                password: hashedPassword,
                role: validatedData.role,
            }
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.signup = signup;
const login = async (req, res, next) => {
    try {
        // 1. Validate payload
        const validatedData = auth_validator_1.loginSchema.parse(req.body);
        // 2. Find user
        const user = await prisma_1.default.user.findUnique({
            where: { email: validatedData.email }
        });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        // 3. Verify password
        const isMatch = await bcryptjs_1.default.compare(validatedData.password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        // 4. Generate token
        const payload = {
            id: user.id,
            role: user.role
        };
        const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
