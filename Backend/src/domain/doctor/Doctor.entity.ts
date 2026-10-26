import { DoctorId } from './DoctorId';
import { Email } from '../patient/Email';
import { AppError } from '../errors/AppError';

export interface DoctorProps {
  doctorId: DoctorId;
  firstName?: string;
  lastName?: string;
  email: Email;
  phone?: string;
  specialization?: string;
}

export class Doctor {
  private readonly _doctorId: DoctorId;
  private _firstName?: string;
  private _lastName?: string;
  private _email: Email;
  private _phone?: string;
  private _specialization?: string;

  constructor(props: DoctorProps) {
    this._doctorId = props.doctorId;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._email = props.email;
    this._phone = props.phone;
    this._specialization = props.specialization;
  }

  public static create(props: DoctorProps): Doctor {
    if (!props.firstName || props.firstName.trim().length === 0) {
      throw new AppError(400, 'First name is required');
    }
    if (!props.lastName || props.lastName.trim().length === 0) {
      throw new AppError(400, 'Last name is required');
    }
    if (!props.phone || props.phone.trim().length === 0) {
      throw new AppError(400, 'Phone number is required');
    }
    if (!props.specialization || props.specialization.trim().length === 0) {
      throw new AppError(400, 'Specialization is required');
    }
    return new Doctor(props);
  }

  public get doctorId(): DoctorId {
    return this._doctorId;
  }

  public get firstName(): string | undefined {
    return this._firstName;
  }

  public get lastName(): string | undefined {
    return this._lastName;
  }

  public get fullName(): string {
    const name = [this._firstName, this._lastName].filter(Boolean).join(' ');
    return name ? `Dr. ${name}` : '';
  }

  public get email(): Email {
    return this._email;
  }

  public get phone(): string | undefined {
    return this._phone;
  }

  public get specialization(): string | undefined {
    return this._specialization;
  }
}
