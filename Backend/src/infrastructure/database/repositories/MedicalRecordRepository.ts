import { IMedicalRecordRepository } from '../../../domain/medical-record/IMedicalRecordRepository';
import { MedicalRecord } from '../../../domain/medical-record/MedicalRecord.entity';
import { MedicalRecordModel, IMedicalRecordDocument } from '../schemas/MedicalRecord.schema';

export class MedicalRecordRepository implements IMedicalRecordRepository {
  public async save(record: MedicalRecord): Promise<void> {
    await MedicalRecordModel.create({
      recordId: record.recordId,
      patientId: record.patientId,
      doctorId: record.doctorId,
      diagnosis: record.diagnosis,
      notes: record.notes,
      allergies: record.allergies,
      createdAt: record.createdAt,
    });
  }

  public async findById(recordId: string): Promise<MedicalRecord | null> {
    const doc = await MedicalRecordModel.findOne({ recordId });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findByPatientId(patientId: string): Promise<MedicalRecord[]> {
    const docs = await MedicalRecordModel.find({ patientId }).sort({ createdAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  public async findAll(): Promise<MedicalRecord[]> {
    const docs = await MedicalRecordModel.find().sort({ createdAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: IMedicalRecordDocument): MedicalRecord {
    return new MedicalRecord({
      recordId: doc.recordId,
      patientId: doc.patientId,
      doctorId: doc.doctorId,
      diagnosis: doc.diagnosis,
      notes: doc.notes,
      allergies: doc.allergies,
      createdAt: new Date(doc.createdAt),
    });
  }
}
