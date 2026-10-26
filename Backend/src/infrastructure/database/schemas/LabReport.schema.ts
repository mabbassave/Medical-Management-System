import mongoose, { Schema, Document } from 'mongoose';

export interface ILabReportDocument extends Document {
  patientId: string;
  doctorId?: string;
  testName: string;
  result: string;
  uploadedAt: Date;
}

const LabReportSchema = new Schema<ILabReportDocument>({
  patientId: { type: String, required: true },
  doctorId: { type: String, required: false },
  testName: { type: String, required: true, trim: true },
  result: { type: String, required: true, trim: true },
  uploadedAt: { type: Date, default: Date.now },
});

export const LabReportModel = mongoose.model<ILabReportDocument>('LabReport', LabReportSchema);
