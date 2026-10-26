import mongoose, { Schema, Document } from 'mongoose';

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface IInvoiceDocument extends Document {
  invoiceId: string;
  patientId: string;
  appointmentId: string;
  items: InvoiceItem[];
  totalAmount: number;
  status: 'pending' | 'paid';
  createdAt: Date;
}

const InvoiceSchema = new Schema<IInvoiceDocument>({
  invoiceId: { type: String, required: true, unique: true },
  patientId: { type: String, required: true, ref: 'Patient' },
  appointmentId: { type: String, required: true, ref: 'Appointment' },
  items: [{
    description: { type: String, required: true },
    amount: { type: Number, required: true },
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

export const InvoiceModel = mongoose.model<IInvoiceDocument>('Invoice', InvoiceSchema);
