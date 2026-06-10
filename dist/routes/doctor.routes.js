"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profile_controller_1 = require("../controllers/profile.controller");
const discovery_controller_1 = require("../controllers/discovery.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
// ==========================================
// DOCTOR ONBOARDING ROUTES (Strictly DOCTOR)
// ==========================================
const doctorOnly = [auth_middleware_1.authenticate, (0, role_middleware_1.authorizeRole)('DOCTOR')];
router.post('/profile', doctorOnly, profile_controller_1.createDoctorProfile);
router.get('/profile', doctorOnly, profile_controller_1.getDoctorProfile);
router.patch('/profile', doctorOnly, profile_controller_1.updateDoctorProfile);
// ==========================================
// DOCTOR DISCOVERY ROUTES (Open to any logged-in user)
// ==========================================
router.get('/', auth_middleware_1.authenticate, discovery_controller_1.getDoctors);
router.get('/:id', auth_middleware_1.authenticate, discovery_controller_1.getDoctorById);
exports.default = router;
