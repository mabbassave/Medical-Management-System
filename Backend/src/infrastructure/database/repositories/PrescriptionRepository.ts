import { IPrescriptionRepository } from '../../../domain/prescription/IPrescriptionRepository';
import { Prescription } from '../../../domain/prescription/Prescription.entity';
import { PrescriptionModel, IPrescriptionDocument } from '../schemas/Prescription.schema';

export class PrescriptionRepository implements IPrescriptionRepository {
  public async save(prescription: Prescription): Promise<void> {
    await PrescriptionModel.create({
      prescriptionId: prescription.prescriptionId,
      patientId: prescription.patientId,
      doctorId: prescription.doctorId,
      medicines: prescription.medicines,
      diagnosis: prescription.diagnosis,
      createdAt: prescription.createdAt,
    });
  }

  public async findById(prescriptionId: string): Promise<Prescription | null> {
    const doc = await PrescriptionModel.findOne({ prescriptionId });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findByPatientId(patientId: string): Promise<Prescription[]> {
    const docs = await PrescriptionModel.find({ patientId }).sort({ createdAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  public async findByDoctorId(doctorId: string): Promise<Prescription[]> {
    const docs = await PrescriptionModel.find({ doctorId }).sort({ createdAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  public async findAll(): Promise<Prescription[]> {
    const docs = await PrescriptionModel.find().sort({ createdAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: IPrescriptionDocument): Prescription {
    return new Prescription({
      prescriptionId: doc.prescriptionId,
      patientId: doc.patientId,
      doctorId: doc.doctorId,
      medicines: doc.medicines,
      diagnosis: doc.diagnosis,
      createdAt: new Date(doc.createdAt),
    });
  }
}
