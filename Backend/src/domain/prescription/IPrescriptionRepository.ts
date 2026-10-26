import { Prescription } from './Prescription.entity';

export interface IPrescriptionRepository {
  save(prescription: Prescription): Promise<void>;
  findById(prescriptionId: string): Promise<Prescription | null>;
  findByPatientId(patientId: string): Promise<Prescription[]>;
  findByDoctorId(doctorId: string): Promise<Prescription[]>;
  findAll(): Promise<Prescription[]>;
}
