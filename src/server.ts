import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import doctorRoutes from './routes/doctor.routes';
import patientRoutes from './routes/patient.routes';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

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
      patient: '/api/patient/profile'
    },
    docs: 'See README.md for full API documentation'
  });
});

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running optimally.' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/patient', patientRoutes);

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT as number, '0.0.0.0', () => {
  console.log(`Server is running beautifully on http://0.0.0.0:${PORT}`);
});
