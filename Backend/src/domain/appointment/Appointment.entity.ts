import { AppointmentStatus } from './AppointmentStatus';
import { AppError } from '../errors/AppError';

export type AppointmentActivityType = 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'RESCHEDULED';
export type AppointmentActorRole = 'patient' | 'doctor' | 'admin' | 'nurse';
export interface AppointmentActivity {
  event: AppointmentActivityType;
  actorRole: AppointmentActorRole;
  appointmentDate: Date;
  occurredAt: Date;
}

export interface AppointmentProps {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  status?: AppointmentStatus;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  activityHistory?: AppointmentActivity[];
}

export class Appointment {
  private readonly _appointmentId: string;
  private readonly _patientId: string;
  private readonly _doctorId: string;
  private _appointmentDate: Date;
  private _status: AppointmentStatus;
  private _notes?: string;
  private readonly _createdAt?: Date;
  private readonly _updatedAt?: Date;
  private readonly _activityHistory: AppointmentActivity[];

  constructor(props: AppointmentProps) {
    this._appointmentId = props.appointmentId;
    this._patientId = props.patientId;
    this._doctorId = props.doctorId;
    this._appointmentDate = props.appointmentDate;
    this._status = props.status || AppointmentStatus.SCHEDULED;
    this._notes = props.notes;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._activityHistory = [...(props.activityHistory || [])];
  }

  public static create(props: AppointmentProps): Appointment {
    if (!props.appointmentId || props.appointmentId.trim().length === 0) {
      throw new AppError(400, 'AppointmentId is required');
    }
    if (!props.patientId || props.patientId.trim().length === 0) {
      throw new AppError(400, 'PatientId is required');
    }
    if (!props.doctorId || props.doctorId.trim().length === 0) {
      throw new AppError(400, 'DoctorId is required');
    }
    if (!props.appointmentDate || isNaN(props.appointmentDate.getTime())) {
      throw new AppError(400, 'A valid appointmentDate is required');
    }
    if (props.appointmentDate.getTime() < Date.now()) {
      throw new AppError(400, 'Appointment date cannot be in the past');
    }

    return new Appointment({
      ...props,
      status: AppointmentStatus.SCHEDULED,
    });
  }

  public cancel(): void {
    if (this._status === AppointmentStatus.COMPLETED) {
      throw new AppError(409, 'Cannot cancel an appointment that is already completed');
    }
    if (this._status === AppointmentStatus.CANCELLED) {
      throw new AppError(409, 'Appointment is already cancelled');
    }
    this._status = AppointmentStatus.CANCELLED;
  }

  public complete(): void {
    if (this._status === AppointmentStatus.CANCELLED) {
      throw new AppError(409, 'Cannot complete a cancelled appointment');
    }
    if (this._status === AppointmentStatus.COMPLETED) {
      throw new AppError(409, 'Appointment is already completed');
    }
    this._status = AppointmentStatus.COMPLETED;
  }

  public reschedule(appointmentDate: Date): void {
    if (this._status !== AppointmentStatus.SCHEDULED) {
      throw new AppError(409, 'Only scheduled appointments can be rescheduled');
    }
    if (Number.isNaN(appointmentDate.getTime()) || appointmentDate.getTime() <= Date.now()) {
      throw new AppError(400, 'Appointment date must be in the future');
    }
    this._appointmentDate = appointmentDate;
  }

  public recordActivity(event: AppointmentActivityType, actorRole: AppointmentActorRole): void {
    this._activityHistory.push({
      event,
      actorRole,
      appointmentDate: new Date(this._appointmentDate),
      occurredAt: new Date(),
    });
  }

  // Getters
  public get appointmentId(): string {
    return this._appointmentId;
  }

  public get patientId(): string {
    return this._patientId;
  }

  public get doctorId(): string {
    return this._doctorId;
  }

  public get appointmentDate(): Date {
    return this._appointmentDate;
  }

  public get status(): AppointmentStatus {
    return this._status;
  }

  public get notes(): string | undefined {
    return this._notes;
  }

  public get createdAt(): Date | undefined {
    return this._createdAt;
  }

  public get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  public get activityHistory(): AppointmentActivity[] {
    return [...this._activityHistory];
  }

  public toJSON() {
    return {
      appointmentId: this._appointmentId,
      patientId: this._patientId,
      doctorId: this._doctorId,
      appointmentDate: this._appointmentDate,
      status: this._status,
      notes: this._notes,
    };
  }
}
