import { randomUUID } from 'crypto';
import { IAppointmentRepository } from '../../domain/appointment/IAppointmentRepository';
import { Appointment } from '../../domain/appointment/Appointment.entity';
import { CreateAppointmentDTO } from './CreateAppointmentDTO';
import { AppError } from '../../domain/errors/AppError';
import { AppointmentActorRole } from '../../domain/appointment/Appointment.entity';

export class AppointmentApplicationService {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  public async bookAppointment(dto: CreateAppointmentDTO, actorRole: AppointmentActorRole = 'patient'): Promise<string> {
    const appointmentId = randomUUID();
    const appointmentDate = new Date(dto.appointmentDate);

    const appointment = Appointment.create({
      appointmentId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      appointmentDate,
      notes: dto.notes,
    });

    if (await this.appointmentRepository.findScheduledAt(dto.doctorId, appointmentDate)) {
      throw new AppError(409, 'That appointment time is already booked. Choose another time.');
    }
    appointment.recordActivity('BOOKED', actorRole);

    await this.appointmentRepository.save(appointment);
    return appointmentId;
  }

  public async cancelAppointment(appointmentId: string, actorRole: AppointmentActorRole = 'patient'): Promise<void> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    appointment.cancel();
    appointment.recordActivity('CANCELLED', actorRole);
    await this.appointmentRepository.update(appointment);
  }

  public async completeAppointment(appointmentId: string, actorRole: AppointmentActorRole): Promise<void> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment) throw new AppError(404, 'Appointment not found');
    appointment.complete();
    appointment.recordActivity('COMPLETED', actorRole);
    await this.appointmentRepository.update(appointment);
  }

  public async rescheduleAppointment(appointmentId: string, appointmentDate: string, actorRole: AppointmentActorRole): Promise<void> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment) throw new AppError(404, 'Appointment not found');
    const nextDate = new Date(appointmentDate);
    appointment.reschedule(nextDate);
    if (await this.appointmentRepository.findScheduledAt(appointment.doctorId, nextDate, appointmentId)) {
      throw new AppError(409, 'That appointment time is already booked. Choose another time.');
    }
    appointment.recordActivity('RESCHEDULED', actorRole);
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
