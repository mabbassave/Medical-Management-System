import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole, requirePatientSelfOrRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createLabReportSchema } from '../schemas';
import { LabReportController } from '../controllers/LabReport.controller';

const labReportRouter = Router();
labReportRouter.use(authMiddleware as any);
const labReportController = new LabReportController();

// POST /patient/:patientId or POST /:patientId - Doctor/Nurse/Admin can create/upload lab reports
labReportRouter.post(
  '/patient/:patientId',
  requireRole('admin', 'doctor', 'nurse'),
  validate(createLabReportSchema),
  labReportController.createReport
);
labReportRouter.post(
  '/:patientId',
  requireRole('admin', 'doctor', 'nurse'),
  validate(createLabReportSchema),
  labReportController.createReport
);

// GET /patient/:patientId or GET /:patientId - Patients can only access their own reports
labReportRouter.get(
  '/patient/:patientId',
  requireRole('admin', 'doctor', 'nurse', 'patient'),
  requirePatientSelfOrRole('patientId', 'doctor', 'nurse', { allowUnassignedDoctorRead: true }),
  labReportController.getReportsByPatient
);
labReportRouter.get(
  '/:patientId',
  requireRole('admin', 'doctor', 'nurse', 'patient'),
  requirePatientSelfOrRole('patientId', 'doctor', 'nurse', { allowUnassignedDoctorRead: true }),
  labReportController.getReportsByPatient
);

export default labReportRouter;
