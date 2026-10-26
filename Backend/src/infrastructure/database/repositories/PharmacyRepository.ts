import { IPharmacyRepository } from '../../../domain/pharmacy/IPharmacyRepository';
import { Medicine } from '../../../domain/pharmacy/Medicine.entity';
import { MedicineModel, IMedicineDocument } from '../schemas/Medicine.schema';

export class PharmacyRepository implements IPharmacyRepository {
  async save(medicine: Medicine): Promise<void> {
    const doc = new MedicineModel({
      medicineId: medicine.medicineId,
      name: medicine.name,
      quantity: medicine.quantity,
      unitPrice: medicine.unitPrice,
      expiryDate: medicine.expiryDate,
    } as IMedicineDocument);
    await doc.save();
  }

  async findById(medicineId: string): Promise<Medicine | null> {
    const doc = await MedicineModel.findOne({ medicineId });
    if (!doc) return null;
    return new Medicine({
      medicineId: doc.medicineId,
      name: doc.name,
      quantity: doc.quantity,
      unitPrice: doc.unitPrice,
      expiryDate: doc.expiryDate,
    });
  }

  async findAll(): Promise<Medicine[]> {
    const docs = await MedicineModel.find();
    return docs.map(
      (doc) =>
        new Medicine({
          medicineId: doc.medicineId,
          name: doc.name,
          quantity: doc.quantity,
          unitPrice: doc.unitPrice,
          expiryDate: doc.expiryDate,
        })
    );
  }

  async update(medicine: Medicine): Promise<void> {
    await MedicineModel.updateOne({ medicineId: medicine.medicineId }, {
      name: medicine.name,
      quantity: medicine.quantity,
      unitPrice: medicine.unitPrice,
      expiryDate: medicine.expiryDate,
    });
  }
}
