import mongoose, { Schema, Document } from 'mongoose';

export interface IVitalsDocument extends Document {
  vitalsId: string;
  patientId?: string;
  doctorId?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  sugarLevel?: number;
  temperature?: number;
  heartRate?: number;
  pulseRate?: number;
  rbcCount?: number;
  wbcCount?: number;
  breathingRate?: number;
  hrv?: number;
  stressLevel?: number;
  bloodPressure?: { systolic: number; diastolic: number };
  spo2?: number;
  selectedMetrics?: string[];
  scanDuration?: number;
  confidence?: number;
  quality?: number;
  status: string;
  flaggedParams: string[];
  message: string;
  recordedAt: Date;
  createdAt?: Date;
}

const VitalsSchema = new Schema<IVitalsDocument>({
  vitalsId: { type: String, required: true, unique: true },
  patientId: { type: String, required: false, index: true },
  doctorId: { type: String, index: true },
  bloodPressureSystolic: { type: Number },
  bloodPressureDiastolic: { type: Number },
  sugarLevel: { type: Number },
  temperature: { type: Number },
  heartRate: { type: Number },
  pulseRate: { type: Number },
  rbcCount: { type: Number },
  wbcCount: { type: Number },
  breathingRate: { type: Number },
  hrv: { type: Number },
  stressLevel: { type: Number },
  bloodPressure: {
    systolic: { type: Number },
    diastolic: { type: Number },
  },
  spo2: { type: Number },
  selectedMetrics: [{ type: String }],
  scanDuration: { type: Number },
  confidence: { type: Number },
  quality: { type: Number },
  status: { type: String, required: true, enum: ['normal', 'warning', 'critical', 'inconclusive'], default: 'inconclusive' },
  flaggedParams: { type: [{ type: String }], default: [] },
  message: { type: String, default: '' },
  recordedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export const VitalsModel = mongoose.model<IVitalsDocument>('Vitals', VitalsSchema);
