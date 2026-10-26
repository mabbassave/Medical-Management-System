import { MedicalRecord } from './MedicalRecord.entity';

export interface IMedicalRecordRepository {
  save(record: MedicalRecord): Promise<void>;
  findById(recordId: string): Promise<MedicalRecord | null>;
  findByPatientId(patientId: string): Promise<MedicalRecord[]>;
  findAll(): Promise<MedicalRecord[]>;
}
