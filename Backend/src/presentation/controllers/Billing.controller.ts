import { Request, Response, NextFunction } from 'express';
import { BillingApplicationService } from '../../application/billing/BillingApplicationService';
import { CreateInvoiceDTO } from '../../application/billing/CreateInvoiceDTO';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { AppError } from '../../domain/errors/AppError';

export class BillingController {
  constructor(private readonly service: BillingApplicationService) {}

  private async getPatientLinkedId(req: Request): Promise<string | undefined> {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.linkedId) {
      return authReq.user.linkedId;
    }
    if (authReq.user?.userId) {
      const user = await UserModel.findById(authReq.user.userId);
      return user?.linkedId;
    }
    return undefined;
  }

  async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const dto: CreateInvoiceDTO = req.body;
    try {
      const id = await this.service.createInvoice(dto);
      res.status(201).json({ id });
    } catch (e) {
      next(e);
    }
  }

  async markInvoicePaid(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = req.params.invoiceId as string;
    const authReq = req as AuthenticatedRequest;
    try {
      if (authReq.user?.role === 'patient') {
        const invoice = await this.service.getInvoiceById(invoiceId);
        if (!invoice) {
          throw new AppError(404, 'Invoice not found');
        }
        const patientLinkedId = await this.getPatientLinkedId(req);
        if (!patientLinkedId || invoice.patientId !== patientLinkedId) {
          throw new AppError(403, 'Forbidden: Patients can only pay their own invoices');
        }
      }

      await this.service.markInvoicePaid(invoiceId);
      res.status(200).json({ message: 'Invoice marked as paid' });
    } catch (e) {
      next(e);
    }
  }

  async getInvoicesByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    let patientId = req.params.patientId as string;
    const authReq = req as AuthenticatedRequest;
    try {
      if (authReq.user?.role === 'patient') {
        const patientLinkedId = await this.getPatientLinkedId(req);
        if (!patientLinkedId || (patientId && patientId !== patientLinkedId)) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
        if (patientLinkedId) {
          patientId = patientLinkedId;
          req.params.patientId = patientLinkedId;
        }
      }

      const invoices = await this.service.getInvoicesByPatient(patientId);
      const data = invoices.map((inv) => ({
        invoiceId: inv.invoiceId,
        patientId: inv.patientId,
        appointmentId: inv.appointmentId,
        items: inv.items,
        totalAmount: inv.totalAmount,
        status: inv.status,
        createdAt: inv.createdAt,
      }));
      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  async getAllInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoices = await this.service.getAllInvoices();
      const data = invoices.map((inv) => ({
        invoiceId: inv.invoiceId,
        patientId: inv.patientId,
        appointmentId: inv.appointmentId,
        items: inv.items,
        totalAmount: inv.totalAmount,
        status: inv.status,
        createdAt: inv.createdAt,
      }));
      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  async getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = req.params.invoiceId as string;
    const authReq = req as AuthenticatedRequest;
    try {
      const invoice = await this.service.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new AppError(404, 'Invoice not found');
      }

      // Patients can only access their own invoices
      if (authReq.user?.role === 'patient') {
        const patientLinkedId = await this.getPatientLinkedId(req);
        if (!patientLinkedId || invoice.patientId !== patientLinkedId) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
      }

      res.json({
        invoiceId: invoice.invoiceId,
        patientId: invoice.patientId,
        appointmentId: invoice.appointmentId,
        items: invoice.items,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        createdAt: invoice.createdAt,
      });
    } catch (e) {
      next(e);
    }
  }
}
