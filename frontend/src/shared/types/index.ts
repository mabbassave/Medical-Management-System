// Shared application types

export interface User {
  id: string;
  name?: string;
  username?: string;
  email: string;
  role: string;
}

export interface Patient {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface Doctor {
  doctorId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  phone?: string;
  specialization?: string;
  licenseNumber?: string;
}

export interface Appointment {
  _id: string;
  patientId: { firstName?: string; lastName?: string; fullName?: string } | string;
  doctorId: { firstName?: string; lastName?: string; fullName?: string; specialization?: string } | string;
  date: string;
  time: string;
  reason?: string;
  status: string;
}

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
}

export interface Prescription {
  _id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  medicines: Medicine[];
  createdAt?: string;
}

export interface BillingItem {
  description: string;
  amount: number;
}

export interface Invoice {
  invoiceId: string;
  patientId: string;
  appointmentId: string;
  items: BillingItem[];
  totalAmount: number;
  status: 'pending' | 'paid';
  createdAt: string;
}

export interface PharmacyMedicine {
  medicineId: string;
  _id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  expiryDate: string;
}

export interface DashboardStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  appointmentsToday: number;
  criticalVitalsCount: number;
}

export interface VitalsRecord {
  vitalsId: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  sugarLevel: number;
  temperature: number;
  oxygenSaturation?: number;
  notes?: string;
  recordedAt: string;
  analysis?: {
    status?: 'normal' | 'warning' | 'critical';
    recommendations?: string[];
  };
}

export interface MedicalRecord {
  _id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  notes?: string;
  allergies?: string[];
  createdAt?: string;
}

export interface LabReport {
  _id: string;
  patientId: string;
  testName: string;
  result: string;
  uploadedAt: string;
}

// API response wrapper
export type ApiResponse<T> = T | { data: T };
