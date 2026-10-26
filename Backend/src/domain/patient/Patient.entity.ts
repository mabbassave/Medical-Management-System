import { PatientId } from './PatientId';
import { Email } from './Email';
import { AppError } from '../errors/AppError';

export interface PatientProps {
  patientId: PatientId;
  firstName?: string;
  lastName?: string;
  email: Email;
  phone?: string;
  dateOfBirth?: Date;
}

export class Patient {
  private readonly _patientId: PatientId;
  private _firstName?: string;
  private _lastName?: string;
  private _email: Email;
  private _phone?: string;
  private _dateOfBirth?: Date;

  constructor(props: PatientProps) {
    this._patientId = props.patientId;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._email = props.email;
    this._phone = props.phone;
    this._dateOfBirth = props.dateOfBirth;
  }

  public static create(props: PatientProps): Patient {
    if (!props.firstName || props.firstName.trim().length === 0) {
      throw new AppError(400, 'First name is required');
    }
    if (!props.lastName || props.lastName.trim().length === 0) {
      throw new AppError(400, 'Last name is required');
    }
    if (!props.phone || props.phone.trim().length === 0) {
      throw new AppError(400, 'Phone number is required');
    }
    return new Patient(props);
  }

  // Getters
  public get patientId(): PatientId {
    return this._patientId;
  }

  public get firstName(): string | undefined {
    return this._firstName;
  }

  public get lastName(): string | undefined {
    return this._lastName;
  }

  public get fullName(): string {
    return [this._firstName, this._lastName].filter(Boolean).join(' ');
  }

  public get email(): Email {
    return this._email;
  }

  public get phone(): string | undefined {
    return this._phone;
  }

  public get dateOfBirth(): Date | undefined {
    return this._dateOfBirth;
  }
}
