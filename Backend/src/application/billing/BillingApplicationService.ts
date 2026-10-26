import { randomUUID } from 'crypto';
import { Invoice } from '../../domain/billing/Invoice.entity';
import { IBillingRepository } from '../../domain/billing/IBillingRepository';
import { CreateInvoiceDTO } from './CreateInvoiceDTO';
import { AppError } from '../../domain/errors/AppError';

export class BillingApplicationService {
  constructor(private readonly billingRepo: IBillingRepository) {}

  public async createInvoice(dto: CreateInvoiceDTO): Promise<string> {
    const invoice = Invoice.create({
      patientId: dto.patientId,
      appointmentId: dto.appointmentId,
      items: dto.items,
    });
    // assign generated id
    const id = randomUUID();
    invoice.invoiceId = id;
    await this.billingRepo.save(invoice);
    return id;
  }

  public async markInvoicePaid(invoiceId: string): Promise<void> {
    const invoice = await this.billingRepo.findById(invoiceId);
    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }
    invoice.markAsPaid();
    await this.billingRepo.update(invoice);
  }

  public async getInvoicesByPatient(patientId: string): Promise<Invoice[]> {
    return await this.billingRepo.findByPatientId(patientId);
  }

  public async getAllInvoices(): Promise<Invoice[]> {
    return await this.billingRepo.findAll();
  }

  public async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    return await this.billingRepo.findById(invoiceId);
  }
}
