import { IAppointmentRepository } from '../../../domain/appointment/IAppointmentRepository';
import { Appointment } from '../../../domain/appointment/Appointment.entity';
import { AppointmentModel, IAppointmentDocument } from '../schemas/Appointment.schema';

export class AppointmentRepository implements IAppointmentRepository {
  public async save(appointment: Appointment): Promise<void> {
    await AppointmentModel.create({
      appointmentId: appointment.appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status,
      notes: appointment.notes,
      activityHistory: appointment.activityHistory,
    });
  }

  public async update(appointment: Appointment): Promise<void> {
    await AppointmentModel.findOneAndUpdate(
      { appointmentId: appointment.appointmentId },
      {
        appointmentDate: appointment.appointmentDate,
        status: appointment.status,
        notes: appointment.notes,
        activityHistory: appointment.activityHistory,
      }
    );
  }

  public async findById(appointmentId: string): Promise<Appointment | null> {
    const doc = await AppointmentModel.findOne({ appointmentId });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findByPatientId(patientId: string): Promise<Appointment[]> {
    const docs = await AppointmentModel.find({ patientId });
    return docs.map((doc) => this.toDomain(doc));
  }

  public async findByDoctorId(doctorId: string): Promise<Appointment[]> {
    const docs = await AppointmentModel.find({ doctorId });
    return docs.map((doc) => this.toDomain(doc));
  }

  public async findAll(): Promise<Appointment[]> {
    const docs = await AppointmentModel.find();
    return docs.map((doc) => this.toDomain(doc));
  }

  public async findScheduledAt(doctorId: string, appointmentDate: Date, excludeAppointmentId?: string): Promise<Appointment | null> {
    const doc = await AppointmentModel.findOne({
      doctorId,
      appointmentDate,
      status: 'SCHEDULED',
      ...(excludeAppointmentId ? { appointmentId: { $ne: excludeAppointmentId } } : {}),
    } as any) as IAppointmentDocument | null;
    return doc ? this.toDomain(doc) : null;
  }

  private toDomain(doc: IAppointmentDocument): Appointment {
    return new Appointment({
      appointmentId: doc.appointmentId,
      patientId: doc.patientId,
      doctorId: doc.doctorId,
      appointmentDate: new Date(doc.appointmentDate),
      status: doc.status,
      notes: doc.notes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      activityHistory: doc.activityHistory,
    });
  }
}
