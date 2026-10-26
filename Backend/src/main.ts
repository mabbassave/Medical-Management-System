import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './infrastructure/config/env';
import { connectDatabase, isDatabaseConnected } from './infrastructure/config/database';
import { errorMiddleware } from './presentation/middlewares/error.middleware';
import { initSocket } from './infrastructure/notifications/socket';
import authRoutes from './presentation/routes/auth.routes';
import patientRoutes from './presentation/routes/patient.routes';
import doctorRoutes from './presentation/routes/doctor.routes';
import appointmentRoutes from './presentation/routes/appointment.routes';
import vitalsRoutes from './presentation/routes/vitals.routes';
import prescriptionRoutes from './presentation/routes/prescription.routes';
import medicalRecordRoutes from './presentation/routes/medical-record.routes';
import labReportRoutes from './presentation/routes/lab-report.routes';
import billingRoutes from './presentation/routes/billing.routes';
import dashboardRoutes from './presentation/routes/dashboard.routes';
import pharmacyRoutes from './presentation/routes/pharmacy.routes';

const app = express();
const server = createServer(app);
const PORT = env.PORT;

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    `Backend HTTP listener failed on port ${PORT} (${error.code || error.name}). ` +
      (error.code === 'EADDRINUSE' ? 'Stop the other process using that port.' : 'Check server configuration.')
  );
  process.exit(1);
});

const allowedClientOrigins = new Set([new URL(env.CLIENT_URL).origin]);
if (env.isDevelopment) {
  const clientUrl = new URL(env.CLIENT_URL);
  if (clientUrl.hostname === 'localhost' || clientUrl.hostname === '127.0.0.1') {
    const loopbackAlias = new URL(clientUrl);
    loopbackAlias.hostname = clientUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    allowedClientOrigins.add(loopbackAlias.origin);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || allowedClientOrigins.has(origin));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check reporting real database status
app.get('/health', (_req: Request, res: Response) => {
  const dbReady = isDatabaseConnected();
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'OK' : 'DEGRADED',
    database: dbReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Database readiness guard for API routes: prevents requests from hanging if DB is down
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      success: false,
      message: 'Database service is currently unavailable. Please verify database connection and retry.',
    });
    return;
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/lab-reports', labReportRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pharmacy', pharmacyRoutes);

app.use(errorMiddleware);

const startServer = async (): Promise<void> => {
  await connectDatabase();
  initSocket(server, [...allowedClientOrigins]);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

void startServer().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(
    `❌ Backend startup failed (${errorName}).\n` +
      'The API was not started because required services are unavailable.'
  );
  process.exit(1);
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Closing HTTP server and database connections...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    } catch {
      // ignore
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

