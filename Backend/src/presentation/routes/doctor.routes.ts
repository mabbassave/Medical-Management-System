import { Router } from 'express';
import { DoctorRepository } from '../../infrastructure/database/repositories/DoctorRepository';
import { DoctorApplicationService } from '../../application/doctor/DoctorApplicationService';
import { DoctorController } from '../controllers/Doctor.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createDoctorSchema } from '../schemas';

const doctorRouter = Router();

// Protect doctor routes with auth middleware
doctorRouter.use(authMiddleware as any);

// Dependency Injection
const doctorRepository = new DoctorRepository();
const doctorService = new DoctorApplicationService(doctorRepository);
const doctorController = new DoctorController(doctorService);

// Route definitions - Only Admin can create doctors
doctorRouter.post('/', requireRole('admin'), validate(createDoctorSchema), doctorController.createDoctor);
doctorRouter.get('/me', requireRole('doctor'), doctorController.getMyDoctor);
doctorRouter.get('/:doctorId', requireRole('admin', 'doctor', 'nurse', 'patient'), doctorController.getDoctor);
doctorRouter.get('/', requireRole('admin', 'doctor', 'nurse', 'patient'), doctorController.getAllDoctors);

export default doctorRouter;
