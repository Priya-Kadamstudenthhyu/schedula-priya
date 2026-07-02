"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leave_controller_1 = require("../controllers/leave.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
// Only DOCTOR role can manage leaves
const doctorOnly = [auth_middleware_1.authenticate, (0, role_middleware_1.authorizeRole)('DOCTOR')];
router.post('/', doctorOnly, leave_controller_1.createLeave);
router.get('/', doctorOnly, leave_controller_1.getLeaves);
router.delete('/:id', doctorOnly, leave_controller_1.deleteLeave);
exports.default = router;
