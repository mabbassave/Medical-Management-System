import { randomUUID } from 'crypto';
import { Medicine } from '../../domain/pharmacy/Medicine.entity';
import { IPharmacyRepository } from '../../domain/pharmacy/IPharmacyRepository';
import { AddMedicineDTO } from './AddMedicineDTO';
import { AppError } from '../../domain/errors/AppError';

export class PharmacyApplicationService {
  constructor(private readonly pharmacyRepo: IPharmacyRepository) {}

  public async addMedicine(dto: AddMedicineDTO): Promise<string> {
    const medicine = Medicine.create({
      name: dto.name,
      quantity: Number(dto.quantity),
      unitPrice: Number(dto.unitPrice),
      expiryDate: new Date(dto.expiryDate),
    });
    const id = randomUUID();
    medicine.medicineId = id;
    await this.pharmacyRepo.save(medicine);
    return id;
  }

  public async getAllMedicines(): Promise<Medicine[]> {
    return await this.pharmacyRepo.findAll();
  }

  public async getMedicineById(medicineId: string): Promise<Medicine | null> {
    return await this.pharmacyRepo.findById(medicineId);
  }

  public async reduceStock(medicineId: string, amount: number): Promise<void> {
    const medicine = await this.pharmacyRepo.findById(medicineId);
    if (!medicine) {
      throw new AppError(404, 'Medicine not found');
    }
    medicine.reduceStock(amount);
    await this.pharmacyRepo.update(medicine);
  }
}
