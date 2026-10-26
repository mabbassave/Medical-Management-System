import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole, requirePatientSelfOrRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createInvoiceSchema } from '../schemas';
import { BillingController } from '../controllers/Billing.controller';
import { BillingApplicationService } from '../../application/billing/BillingApplicationService';
import { BillingRepository } from '../../infrastructure/database/repositories/BillingRepository';

const router = Router();
router.use(authMiddleware as any);
const service = new BillingApplicationService(new BillingRepository());
const controller = new BillingController(service);

// Get all invoices - Staff only
router.get('/', requireRole('admin', 'doctor', 'nurse'), controller.getAllInvoices.bind(controller));

// Create a new invoice - Staff only
router.post('/', requireRole('admin', 'doctor', 'nurse'), validate(createInvoiceSchema), controller.createInvoice.bind(controller));

// Mark invoice as paid - Admin and Patient (no body needed — invoiceId from URL param)
router.put('/:invoiceId/pay', requireRole('admin', 'patient'), controller.markInvoicePaid.bind(controller));

// Get invoices by patient - Patients can only view their own; Staff have access
router.get(
  '/patient/:patientId',
  requireRole('admin', 'doctor', 'nurse', 'patient'),
  requirePatientSelfOrRole('patientId', 'doctor', 'nurse', { allowUnassignedDoctorRead: true }),
  controller.getInvoicesByPatient.bind(controller)
);

// Get single invoice by ID
router.get('/:invoiceId', requireRole('admin', 'doctor', 'nurse', 'patient'), controller.getInvoiceById.bind(controller));

export default router;
