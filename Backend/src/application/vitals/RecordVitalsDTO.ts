export interface RecordVitalsDTO {
  patientId: string;
  doctorId?: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  sugarLevel: number;
  temperature: number;
  heartRate: number;
  pulseRate: number;
  rbcCount: number;
  wbcCount: number;
}
