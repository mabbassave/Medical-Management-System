import mongoose, { Schema, Document } from 'mongoose';
import { AppointmentStatus } from '../../../domain/appointment/AppointmentStatus';

export interface IAppointmentDocument extends Document {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  status: AppointmentStatus;
  notes?: string;
  createdAt: Date;
}

const AppointmentSchema = new Schema<IAppointmentDocument>({
  appointmentId: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  appointmentDate: { type: Date, required: true },
  status: {
    type: String,
    enum: Object.values(AppointmentStatus),
    default: AppointmentStatus.SCHEDULED,
  },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const AppointmentModel = mongoose.model<IAppointmentDocument>('Appointment', AppointmentSchema);
