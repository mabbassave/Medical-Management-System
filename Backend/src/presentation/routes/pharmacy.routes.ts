import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { addMedicineSchema, reduceStockSchema } from '../schemas';
import { PharmacyController } from '../controllers/Pharmacy.controller';
import { PharmacyApplicationService } from '../../application/pharmacy/PharmacyApplicationService';
import { PharmacyRepository } from '../../infrastructure/database/repositories/PharmacyRepository';

const router = Router();
router.use(authMiddleware as any);
const repository = new PharmacyRepository();
const service = new PharmacyApplicationService(repository);
const controller = new PharmacyController(service);

// Get all medicines - Accessible by all authenticated roles
router.get('/', requireRole('admin', 'doctor', 'nurse', 'patient'), controller.getAllMedicines.bind(controller));

// Add a new medicine - Staff only
router.post('/', requireRole('admin', 'doctor', 'nurse'), validate(addMedicineSchema), controller.addMedicine.bind(controller));

// Reduce stock - Staff only
router.put('/:id/reduce-stock', requireRole('admin', 'doctor', 'nurse'), validate(reduceStockSchema), controller.reduceStock.bind(controller));

// Get single medicine by id - Accessible by all authenticated roles
router.get('/:id', requireRole('admin', 'doctor', 'nurse', 'patient'), controller.getMedicineById.bind(controller));

export default router;
