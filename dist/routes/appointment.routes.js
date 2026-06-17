"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointment_controller_1 = require("../controllers/appointment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
// Only PATIENT can access these routes
const patientOnly = [auth_middleware_1.authenticate, (0, role_middleware_1.authorizeRole)('PATIENT')];
router.post('/', patientOnly, appointment_controller_1.bookAppointment);
router.get('/my', patientOnly, appointment_controller_1.getPatientAppointments);
router.patch('/:id/cancel', patientOnly, appointment_controller_1.cancelAppointment);
router.patch('/:id/reschedule', patientOnly, appointment_controller_1.rescheduleAppointment);
exports.default = router;
