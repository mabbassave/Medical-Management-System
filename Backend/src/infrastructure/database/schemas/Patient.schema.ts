import mongoose, { Schema, Document } from 'mongoose';

export interface IPatientDocument extends Document {
  patientId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  dateOfBirth?: Date;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PatientSchema = new Schema<IPatientDocument>({
  patientId: { type: String, required: true, unique: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  dateOfBirth: { type: Date },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

PatientSchema.index({ userId: 1 }, { unique: true, sparse: true });

export const PatientModel = mongoose.model<IPatientDocument>('Patient', PatientSchema);
