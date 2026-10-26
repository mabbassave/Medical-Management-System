import { Medicine } from './Medicine.entity';

export interface IPharmacyRepository {
  save(medicine: Medicine): Promise<void>;
  findById(medicineId: string): Promise<Medicine | null>;
  findAll(): Promise<Medicine[]>;
  update(medicine: Medicine): Promise<void>;
}


