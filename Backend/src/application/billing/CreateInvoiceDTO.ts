// DTO for creating an invoice
export interface CreateInvoiceDTO {
  patientId: string;
  appointmentId: string;
  items: { description: string; amount: number }[];
}
