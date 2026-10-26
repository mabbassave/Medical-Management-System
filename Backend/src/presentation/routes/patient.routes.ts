import { Router } from 'express';
import { PatientRepository } from '../../infrastructure/database/repositories/PatientRepository';
import { PatientApplicationService } from '../../application/patient/PatientApplicationService';
import { PatientController } from '../controllers/Patient.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole, requirePatientSelfOrRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createPatientSchema } from '../schemas';

const patientRouter = Router();

// Protect all patient routes with auth middleware
patientRouter.use(authMiddleware as any);

// Dependency Injection
const patientRepository = new PatientRepository();
const patientService = new PatientApplicationService(patientRepository);
const patientController = new PatientController(patientService);

// Route definitions
// Admin, Doctor, Nurse can create patients
patientRouter.post('/', requireRole('admin', 'doctor', 'nurse'), validate(createPatientSchema), patientController.createPatient);

// Patients can view their own profile via /me
patientRouter.get('/me', requireRole('patient'), patientController.getMyPatient);

// Doctors can use the narrow assigned-only directory in clinical workflows.
patientRouter.get('/assigned', requireRole('doctor'), patientController.getAssignedPatients);

// Patient details: Staff can view; Patients can only view their own record
patientRouter.get(
  '/:patientId',
  requireRole('admin', 'doctor', 'nurse', 'patient'),
  requirePatientSelfOrRole('patientId', 'doctor', 'nurse', { allowUnassignedDoctorRead: true }),
  patientController.getPatient
);

// Staff only can view the complete patient roster
patientRouter.get('/', requireRole('admin', 'doctor', 'nurse'), patientController.getAllPatients);

export default patientRouter;
