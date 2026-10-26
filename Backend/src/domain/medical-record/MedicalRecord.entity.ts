import { AppError } from '../errors/AppError';

export interface MedicalRecordProps {
  recordId: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  notes: string;
  allergies: string[];
  createdAt?: Date;
}

export class MedicalRecord {
  private readonly _recordId: string;
  private readonly _patientId: string;
  private readonly _doctorId: string;
  private _diagnosis: string;
  private _notes: string;
  private _allergies: string[];
  private readonly _createdAt: Date;

  constructor(props: MedicalRecordProps) {
    this._recordId = props.recordId;
    this._patientId = props.patientId;
    this._doctorId = props.doctorId;
    this._diagnosis = props.diagnosis;
    this._notes = props.notes;
    this._allergies = props.allergies || [];
    this._createdAt = props.createdAt || new Date();
  }

  public static create(props: MedicalRecordProps): MedicalRecord {
    if (!props.recordId || props.recordId.trim().length === 0) {
      throw new AppError(400, 'RecordId is required');
    }
    if (!props.patientId || props.patientId.trim().length === 0) {
      throw new AppError(400, 'PatientId is required');
    }
    if (!props.doctorId || props.doctorId.trim().length === 0) {
      throw new AppError(400, 'DoctorId is required');
    }
    if (!props.diagnosis || props.diagnosis.trim().length === 0) {
      throw new AppError(400, 'Diagnosis is required');
    }
    return new MedicalRecord(props);
  }

  public get recordId(): string {
    return this._recordId;
  }

  public get patientId(): string {
    return this._patientId;
  }

  public get doctorId(): string {
    return this._doctorId;
  }

  public get diagnosis(): string {
    return this._diagnosis;
  }

  public get notes(): string {
    return this._notes;
  }

  public get allergies(): string[] {
    return this._allergies;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }
}
