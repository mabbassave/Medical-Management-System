import { IBillingRepository } from '../../../domain/billing/IBillingRepository';
import { Invoice } from '../../../domain/billing/Invoice.entity';
import { InvoiceModel, IInvoiceDocument } from '../schemas/Invoice.schema';

export class BillingRepository implements IBillingRepository {
  async save(invoice: Invoice): Promise<void> {
    const doc = new InvoiceModel({
      invoiceId: invoice.invoiceId,
      patientId: invoice.patientId,
      appointmentId: invoice.appointmentId,
      items: invoice.items,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      createdAt: invoice.createdAt,
    } as IInvoiceDocument);
    await doc.save();
  }

  async findById(invoiceId: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findOne({ invoiceId });
    if (!doc) return null;
    return new Invoice({
      invoiceId: doc.invoiceId,
      patientId: doc.patientId,
      appointmentId: doc.appointmentId,
      items: doc.items,
      totalAmount: doc.totalAmount,
      status: doc.status,
      createdAt: doc.createdAt,
    });
  }

  async findByPatientId(patientId: string): Promise<Invoice[]> {
    const docs = await InvoiceModel.find({ patientId });
    return docs.map(
      (doc) =>
        new Invoice({
          invoiceId: doc.invoiceId,
          patientId: doc.patientId,
          appointmentId: doc.appointmentId,
          items: doc.items,
          totalAmount: doc.totalAmount,
          status: doc.status,
          createdAt: doc.createdAt,
        })
    );
  }

  async findAll(): Promise<Invoice[]> {
    const docs = await InvoiceModel.find();
    return docs.map(
      (doc) =>
        new Invoice({
          invoiceId: doc.invoiceId,
          patientId: doc.patientId,
          appointmentId: doc.appointmentId,
          items: doc.items,
          totalAmount: doc.totalAmount,
          status: doc.status,
          createdAt: doc.createdAt,
        })
    );
  }

  async update(invoice: Invoice): Promise<void> {
    await InvoiceModel.updateOne({ invoiceId: invoice.invoiceId }, {
      patientId: invoice.patientId,
      appointmentId: invoice.appointmentId,
      items: invoice.items,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
    });
  }
}
