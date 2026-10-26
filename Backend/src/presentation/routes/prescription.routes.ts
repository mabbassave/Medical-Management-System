import { Router, type RequestHandler } from 'express';
import { PrescriptionRepository } from '../../infrastructure/database/repositories/PrescriptionRepository';
import { PrescriptionApplicationService } from '../../application/prescription/PrescriptionApplicationService';
import { PrescriptionController } from '../controllers/Prescription.controller';
import { authMiddleware, type AuthenticatedRequest } from '../middlewares/auth.middleware';
import { requireRole, requirePatientSelfOrRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createPrescriptionSchema } from '../schemas';
import { PatientModel } from '../../infrastructure/database/schemas/Patient.schema';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';

const prescriptionRouter = Router();

// Protect prescription routes with auth middleware
prescriptionRouter.use(authMiddleware as any);

// Dependency Injection
const prescriptionRepository = new PrescriptionRepository();
const prescriptionService = new PrescriptionApplicationService(prescriptionRepository);
const prescriptionController = new PrescriptionController(prescriptionService);

// Prescription creation permits verified doctors to prescribe for any existing
// patient. Other patient-record routes retain appointment-based authorization.
const authorizePrescriptionCreation: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user?.role.toLowerCase();

    if (role === 'doctor') {
      const user = authReq.user?.userId ? await UserModel.findById(authReq.user.userId) : null;
      if (!user || user.role !== 'doctor' || user.doctorVerificationStatus !== 'verified') {
        res.status(403).json({ success: false, message: 'Verified doctor access is required to create prescriptions.' });
        return;
      }

      const doctorId = await ensureUserProfile(user);
      if (!doctorId) {
        res.status(403).json({ success: false, message: 'No doctor profile is linked to this account.' });
        return;
      }
      authReq.user!.linkedId = doctorId;
      req.body.doctorId = doctorId;
    }

    const patientExists = await PatientModel.exists({ patientId: req.body.patientId });
    if (!patientExists) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Route definitions
// Doctor & Admin only can create prescriptions
prescriptionRouter.post(
  '/',
  requireRole('admin', 'doctor'),
  validate(createPrescriptionSchema),
  authorizePrescriptionCreation,
  prescriptionController.createPrescription
);

// Patients can only view their own prescriptions; staff has access
prescriptionRouter.get(
  '/patient/:patientId',
  requireRole('admin', 'doctor', 'nurse', 'patient'),
  requirePatientSelfOrRole('patientId', 'doctor', 'nurse'),
  prescriptionController.getPrescriptionsByPatient
);

// Prescriptions issued by doctor: Doctor, Nurse, Admin
prescriptionRouter.get('/doctor/:doctorId', requireRole('admin', 'doctor', 'nurse'), prescriptionController.getPrescriptionsByDoctor);

export default prescriptionRouter;
