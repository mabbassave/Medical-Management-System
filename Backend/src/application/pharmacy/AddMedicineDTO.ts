export interface AddMedicineDTO {
  name: string;
  quantity: number;
  unitPrice: number;
  expiryDate: string; // ISO date string
}
