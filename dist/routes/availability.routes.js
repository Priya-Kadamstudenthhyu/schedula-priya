"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const availability_controller_1 = require("../controllers/availability.controller");
const router = (0, express_1.Router)();
// All availability routes require authentication + DOCTOR role
const doctorOnly = [auth_middleware_1.authenticate, (0, role_middleware_1.authorizeRole)('DOCTOR')];
// ── Recurring Weekly Availability ──────────────────────────
router.post('/', doctorOnly, availability_controller_1.createRecurringAvailability);
router.get('/', doctorOnly, availability_controller_1.getRecurringAvailability);
router.patch('/:id', doctorOnly, availability_controller_1.updateRecurringAvailability);
router.delete('/:id', doctorOnly, availability_controller_1.deleteRecurringAvailability);
// ── Custom Date Override ───────────────────────────────────
router.post('/override', doctorOnly, availability_controller_1.createCustomAvailability);
router.get('/date', doctorOnly, availability_controller_1.getAvailabilityByDate);
exports.default = router;
