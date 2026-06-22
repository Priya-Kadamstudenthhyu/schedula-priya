import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient instance for the whole application
const prisma = new PrismaClient();

export default prisma;
