import { Request, Response, NextFunction } from 'express';
import { PharmacyApplicationService } from '../../application/pharmacy/PharmacyApplicationService';
import { AddMedicineDTO } from '../../application/pharmacy/AddMedicineDTO';
import { AppError } from '../../domain/errors/AppError';

export class PharmacyController {
  constructor(private readonly service: PharmacyApplicationService) {}

  async addMedicine(req: Request, res: Response, next: NextFunction): Promise<void> {
    const dto: AddMedicineDTO = req.body;
    try {
      const id = await this.service.addMedicine({
        name: dto.name,
        quantity: Number(dto.quantity),
        unitPrice: Number(dto.unitPrice),
        expiryDate: dto.expiryDate,
      });
      res.status(201).json({ id, success: true, message: 'Medicine added successfully' });
    } catch (e) {
      next(e);
    }
  }

  async getAllMedicines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const medicines = await this.service.getAllMedicines();
      const data = medicines.map((m) => ({
        medicineId: m.medicineId,
        name: m.name,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
        expiryDate: m.expiryDate,
      }));
      res.status(200).json(data);
    } catch (e) {
      next(e);
    }
  }

  async getMedicineById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const medicineId = (req.params.id || req.params.medicineId) as string;
    try {
      const medicine = await this.service.getMedicineById(medicineId);
      if (!medicine) {
        throw new AppError(404, 'Medicine not found');
      }
      res.status(200).json({
        medicineId: medicine.medicineId,
        name: medicine.name,
        quantity: medicine.quantity,
        unitPrice: medicine.unitPrice,
        expiryDate: medicine.expiryDate,
      });
    } catch (e) {
      next(e);
    }
  }

  async reduceStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    const medicineId = (req.params.id || req.params.medicineId) as string;
    const { amount } = req.body; // expecting { amount: number }
    try {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new AppError(400, 'Amount must be a positive number');
      }

      await this.service.reduceStock(medicineId, numericAmount);
      res.status(200).json({ success: true, message: 'Stock reduced successfully' });
    } catch (e) {
      next(e);
    }
  }
}
