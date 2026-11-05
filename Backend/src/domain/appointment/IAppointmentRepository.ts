import { Appointment } from './Appointment.entity';

export interface IAppointmentRepository {
  save(appointment: Appointment): Promise<void>;
  findById(appointmentId: string): Promise<Appointment | null>;
  findByPatientId(patientId: string): Promise<Appointment[]>;
  findByDoctorId(doctorId: string): Promise<Appointment[]>;
  findAll(): Promise<Appointment[]>;
  update(appointment: Appointment): Promise<void>;
  findScheduledAt(doctorId: string, appointmentDate: Date, excludeAppointmentId?: string): Promise<Appointment | null>;
}
