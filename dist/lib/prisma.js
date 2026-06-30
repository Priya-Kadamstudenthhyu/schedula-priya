"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Single shared PrismaClient instance for the whole application
const prisma = new client_1.PrismaClient();
exports.default = prisma;
