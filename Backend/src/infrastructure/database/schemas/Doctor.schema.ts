import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctorDocument extends Document {
  doctorId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  specialization?: string;
  licenseNumber?: string;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const DoctorSchema = new Schema<IDoctorDocument>({
  doctorId: { type: String, required: true, unique: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  specialization: { type: String, trim: true },
  licenseNumber: { type: String, trim: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

DoctorSchema.index({ userId: 1 }, { unique: true, sparse: true });

export const DoctorModel = mongoose.model<IDoctorDocument>('Doctor', DoctorSchema);
