import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicineDocument extends Document {
  medicineId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  expiryDate: Date;
}

const MedicineSchema = new Schema<IMedicineDocument>({
  medicineId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  expiryDate: { type: Date, required: true },
});

export const MedicineModel = mongoose.model<IMedicineDocument>('Medicine', MedicineSchema);
