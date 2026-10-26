import { randomUUID } from 'crypto';
import { IPrescriptionRepository } from '../../domain/prescription/IPrescriptionRepository';
import { Prescription } from '../../domain/prescription/Prescription.entity';
import { CreatePrescriptionDTO } from './CreatePrescriptionDTO';

export class PrescriptionApplicationService {
  constructor(private readonly prescriptionRepository: IPrescriptionRepository) {}

  public async createPrescription(dto: CreatePrescriptionDTO): Promise<string> {
    const prescriptionId = randomUUID();

    const prescription = Prescription.create({
      prescriptionId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      medicines: dto.medicines,
      diagnosis: dto.diagnosis,
      createdAt: new Date(),
    });

    await this.prescriptionRepository.save(prescription);
    return prescriptionId;
  }

  public async getPrescriptionsByPatient(patientId: string): Promise<Prescription[]> {
    return await this.prescriptionRepository.findByPatientId(patientId);
  }

  public async getPrescriptionsByDoctor(doctorId: string): Promise<Prescription[]> {
    return await this.prescriptionRepository.findByDoctorId(doctorId);
  }
}
