import { Router } from 'express';
import { MedicalRecordRepository } from '../../infrastructure/database/repositories/MedicalRecordRepository';
import { MedicalRecordApplicationService } from '../../application/medical-record/MedicalRecordApplicationService';
import { MedicalRecordController } from '../controllers/MedicalRecord.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole, requirePatientSelfOrRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createMedicalRecordSchema } from '../schemas';

const medicalRecordRouter = Router();

// Protect routes with auth middleware
medicalRecordRouter.use(authMiddleware as any);

// Dependency Injection
const medicalRecordRepository = new MedicalRecordRepository();
const medicalRecordService = new MedicalRecordApplicationService(medicalRecordRepository);
const medicalRecordController = new MedicalRecordController(medicalRecordService);

// Route definitions
// Doctor & Admin only can create medical records
medicalRecordRouter.post(
  '/',
  requireRole('admin', 'doctor'),
  validate(createMedicalRecordSchema),
  medicalRecordController.createRecord
);

// Patients can only view their own medical records; staff has access
medicalRecordRouter.get(
  '/patient/:patientId',
  requireRole('admin', 'doctor', 'nurse', 'patient'),
  requirePatientSelfOrRole('patientId', 'doctor', 'nurse', { allowUnassignedDoctorRead: true }),
  medicalRecordController.getRecordsByPatient
);

export default medicalRecordRouter;
