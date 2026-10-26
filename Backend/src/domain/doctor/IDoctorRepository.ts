import { Doctor } from './Doctor.entity';
import { DoctorId } from './DoctorId';
import { Email } from '../patient/Email';

export interface IDoctorRepository {
  save(doctor: Doctor): Promise<void>;
  findById(doctorId: DoctorId): Promise<Doctor | null>;
  findByEmail(email: Email): Promise<Doctor | null>;
  findAll(): Promise<Doctor[]>;
}
