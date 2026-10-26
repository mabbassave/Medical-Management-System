import { randomUUID } from 'crypto';
import { IMedicalRecordRepository } from '../../domain/medical-record/IMedicalRecordRepository';
import { MedicalRecord } from '../../domain/medical-record/MedicalRecord.entity';
import { CreateMedicalRecordDTO } from './CreateMedicalRecordDTO';

export class MedicalRecordApplicationService {
  constructor(private readonly medicalRecordRepository: IMedicalRecordRepository) {}

  public async createRecord(dto: CreateMedicalRecordDTO): Promise<string> {
    const recordId = randomUUID();

    const record = MedicalRecord.create({
      recordId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      diagnosis: dto.diagnosis,
      notes: dto.notes,
      allergies: dto.allergies || [],
      createdAt: new Date(),
    });

    await this.medicalRecordRepository.save(record);
    return recordId;
  }

  public async getRecordsByPatient(patientId: string): Promise<MedicalRecord[]> {
    return await this.medicalRecordRepository.findByPatientId(patientId);
  }
}
