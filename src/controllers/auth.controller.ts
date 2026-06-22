import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { signupSchema, loginSchema } from '../validators/auth.validator';
import prisma from '../lib/prisma';

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Validate payload
    const validatedData = signupSchema.parse(req.body);

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    // 4. Create user
    const user = await prisma.user.create({
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
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Validate payload
    const validatedData = loginSchema.parse(req.body);

    // 2. Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(validatedData.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 4. Generate token
    const payload = {
      id: user.id,
      role: user.role
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

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
  } catch (error) {
    next(error);
  }
};
