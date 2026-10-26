export interface CreateMedicalRecordDTO {
  patientId: string;
  doctorId: string;
  diagnosis: string;
  notes: string;
  allergies: string[];
}
