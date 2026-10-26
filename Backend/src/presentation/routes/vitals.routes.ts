import { Router } from 'express';
import { VitalsRepository } from '../../infrastructure/database/repositories/VitalsRepository';
import { VitalsApplicationService } from '../../application/vitals/VitalsApplicationService';
import { VitalsController } from '../controllers/Vitals.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole, requirePatientSelfOrRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { recordDoctorOwnedScanSchema, recordVitalsSchema } from '../schemas';

const vitalsRouter = Router();

// Protect vitals routes with auth middleware
vitalsRouter.use(authMiddleware as any);

// Dependency Injection
const vitalsRepository = new VitalsRepository();
const vitalsService = new VitalsApplicationService(vitalsRepository);
const vitalsController = new VitalsController(vitalsService);

// Route definitions - Doctor/Nurse/Admin can record vitals; Patients can only view their own vitals
vitalsRouter.post(
  '/scan',
  requireRole('doctor', 'patient'),
  validate(recordDoctorOwnedScanSchema),
  vitalsController.recordVitals
);
vitalsRouter.get('/mine', requireRole('doctor', 'patient'), vitalsController.getMyScanHistory);
vitalsRouter.post(
  '/',
  requireRole('doctor'),
  requirePatientSelfOrRole('patientId', 'doctor'),
  validate(recordVitalsSchema),
  vitalsController.recordVitals
);
vitalsRouter.get(
  '/',
  requireRole('doctor', 'patient', 'admin'),
  requirePatientSelfOrRole('patientId', 'doctor'),
  vitalsController.getVitalsByPatient
);
vitalsRouter.get(
  '/patient/:patientId',
  requireRole('admin', 'doctor', 'patient'),
  requirePatientSelfOrRole('patientId', 'doctor'),
  vitalsController.getVitalsByPatient
);

export default vitalsRouter;
