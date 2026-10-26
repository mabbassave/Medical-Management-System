import { AppointmentStatus } from './AppointmentStatus';
import { AppError } from '../errors/AppError';

export interface AppointmentProps {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  status?: AppointmentStatus;
  notes?: string;
}

export class Appointment {
  private readonly _appointmentId: string;
  private readonly _patientId: string;
  private readonly _doctorId: string;
  private _appointmentDate: Date;
  private _status: AppointmentStatus;
  private _notes?: string;

  constructor(props: AppointmentProps) {
    this._appointmentId = props.appointmentId;
    this._patientId = props.patientId;
    this._doctorId = props.doctorId;
    this._appointmentDate = props.appointmentDate;
    this._status = props.status || AppointmentStatus.SCHEDULED;
    this._notes = props.notes;
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
    this._status = AppointmentStatus.CANCELLED;
  }

  public complete(): void {
    if (this._status === AppointmentStatus.CANCELLED) {
      throw new AppError(409, 'Cannot complete a cancelled appointment');
    }
    this._status = AppointmentStatus.COMPLETED;
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
