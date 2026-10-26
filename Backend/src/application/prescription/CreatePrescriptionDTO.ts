import { Medicine } from '../../domain/prescription/Prescription.entity';

export interface CreatePrescriptionDTO {
  patientId: string;
  doctorId: string;
  medicines: Medicine[];
  diagnosis: string;
}
