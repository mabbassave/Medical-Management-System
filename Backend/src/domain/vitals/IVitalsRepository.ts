import { Vitals } from './Vitals.entity';

export interface IVitalsRepository {
  save(vitals: Vitals): Promise<void>;
  findById(vitalsId: string): Promise<Vitals | null>;
  findByPatientId(patientId: string): Promise<Vitals[]>;
  findAll(): Promise<Vitals[]>;
}
