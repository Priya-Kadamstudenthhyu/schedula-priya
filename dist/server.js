"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const doctor_routes_1 = __importDefault(require("./routes/doctor.routes"));
const patient_routes_1 = __importDefault(require("./routes/patient.routes"));
const availability_routes_1 = __importDefault(require("./routes/availability.routes"));
const appointment_routes_1 = __importDefault(require("./routes/appointment.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// Root Welcome Route
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Welcome to Schedula API! 🏥',
        status: 'running',
        version: '1.0.0',
        description: 'A backend API for doctor-patient appointment scheduling',
        endpoints: {
            auth: '/api/auth/signup, /api/auth/login',
            doctor: '/api/doctor, /api/doctor/:id, /api/doctor/profile',
            patient: '/api/patient/profile',
            appointment: '/api/appointment'
        },
        docs: 'See README.md for full API documentation'
    });
});
// Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API is running optimally.' });
});
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/doctor/availability', availability_routes_1.default);
app.use('/api/doctor', doctor_routes_1.default);
app.use('/api/appointment', appointment_routes_1.default);
app.use('/api/patient', patient_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
// Global Error Handler
app.use(error_middleware_1.errorHandler);
// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running beautifully on http://0.0.0.0:${PORT}`);
});
