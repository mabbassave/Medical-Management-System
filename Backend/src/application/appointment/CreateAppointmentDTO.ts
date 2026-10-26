export interface CreateAppointmentDTO {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  notes?: string;
}
