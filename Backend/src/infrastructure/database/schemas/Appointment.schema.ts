import mongoose, { Schema, Document } from 'mongoose';
import { AppointmentStatus } from '../../../domain/appointment/AppointmentStatus';

const AppointmentActivitySchema = new Schema({
  event: { type: String, enum: ['BOOKED', 'CANCELLED', 'COMPLETED', 'RESCHEDULED'], required: true },
  actorRole: { type: String, enum: ['patient', 'doctor', 'admin', 'nurse'], required: true },
  appointmentDate: { type: Date, required: true },
  occurredAt: { type: Date, required: true, default: Date.now },
}, { _id: false });

export interface IAppointmentDocument extends Document {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  status: AppointmentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  activityHistory: Array<{
    event: 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'RESCHEDULED';
    actorRole: 'patient' | 'doctor' | 'admin' | 'nurse';
    appointmentDate: Date;
    occurredAt: Date;
  }>;
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
  activityHistory: { type: [AppointmentActivitySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

AppointmentSchema.index(
  { doctorId: 1, appointmentDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: AppointmentStatus.SCHEDULED },
    name: 'unique_scheduled_doctor_time_slot',
  }
);

export const AppointmentModel = mongoose.model<IAppointmentDocument>('Appointment', AppointmentSchema);
