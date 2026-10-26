import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicalRecordDocument extends Document {
  recordId: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  notes: string;
  allergies: string[];
  createdAt: Date;
}

const MedicalRecordSchema = new Schema<IMedicalRecordDocument>({
  recordId: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  diagnosis: { type: String, required: true },
  notes: { type: String, required: true },
  allergies: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export const MedicalRecordModel = mongoose.model<IMedicalRecordDocument>(
  'MedicalRecord',
  MedicalRecordSchema
);
