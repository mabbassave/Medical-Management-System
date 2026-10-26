import { Patient } from './Patient.entity';
import { PatientId } from './PatientId';
import { Email } from './Email';

export interface IPatientRepository {
  save(patient: Patient): Promise<void>;
  findById(patientId: PatientId): Promise<Patient | null>;
  findByEmail(email: Email): Promise<Patient | null>;
  findAll(): Promise<Patient[]>;
}
