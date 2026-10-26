import { randomUUID } from 'crypto';
import { IAppointmentRepository } from '../../domain/appointment/IAppointmentRepository';
import { Appointment } from '../../domain/appointment/Appointment.entity';
import { CreateAppointmentDTO } from './CreateAppointmentDTO';
import { AppError } from '../../domain/errors/AppError';

export class AppointmentApplicationService {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  public async bookAppointment(dto: CreateAppointmentDTO): Promise<string> {
    const appointmentId = randomUUID();
    const appointmentDate = new Date(dto.appointmentDate);

    const appointment = Appointment.create({
      appointmentId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      appointmentDate,
      notes: dto.notes,
    });

    await this.appointmentRepository.save(appointment);
    return appointmentId;
  }

  public async cancelAppointment(appointmentId: string): Promise<void> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    appointment.cancel();
    await this.appointmentRepository.update(appointment);
  }

  public async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    return await this.appointmentRepository.findByPatientId(patientId);
  }

  public async getAppointmentsByDoctor(doctorId: string): Promise<Appointment[]> {
    return await this.appointmentRepository.findByDoctorId(doctorId);
  }

  public async getAllAppointments(): Promise<Appointment[]> {
    return await this.appointmentRepository.findAll();
  }

  public async getAppointmentById(appointmentId: string): Promise<Appointment | null> {
    return await this.appointmentRepository.findById(appointmentId);
  }
}
