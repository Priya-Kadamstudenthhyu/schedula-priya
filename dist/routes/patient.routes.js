"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profile_controller_1 = require("../controllers/profile.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
// Apply Authentication and Role Guard ('PATIENT') to all routes in this file
router.use(auth_middleware_1.authenticate, (0, role_middleware_1.authorizeRole)('PATIENT'));
// Profile Routes
router.post('/profile', profile_controller_1.createPatientProfile);
router.get('/profile', profile_controller_1.getPatientProfile);
router.patch('/profile', profile_controller_1.updatePatientProfile);
exports.default = router;
