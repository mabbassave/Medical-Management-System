import { Invoice } from './Invoice.entity';

export interface IBillingRepository {
  save(invoice: Invoice): Promise<void>;
  findById(invoiceId: string): Promise<Invoice | null>;
  findByPatientId(patientId: string): Promise<Invoice[]>;
  findAll(): Promise<Invoice[]>;
  update(invoice: Invoice): Promise<void>;
}
