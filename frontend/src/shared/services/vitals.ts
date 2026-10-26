import api from './api';

export interface VitalsAnalysis {
  status?: 'normal' | 'warning' | 'critical' | 'inconclusive';
  message?: string;
  flaggedParams?: string[];
}

export interface VitalsRecord {
  vitalsId: string;
  patientId: string;
  doctorId?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  sugarLevel?: number;
  temperature?: number;
  heartRate?: number;
  pulseRate?: number;
  rbcCount?: number;
  wbcCount?: number;
  breathingRate?: number;
  hrv?: number;
  stressLevel?: number;
  bloodPressure?: { systolic: number; diastolic: number };
  spo2?: number;
  selectedMetrics?: string[];
  scanDuration?: number;
  confidence?: number;
  quality?: number;
  recordedAt: string;
  analysis?: VitalsAnalysis;
}

export const parseVitalsResponse = (response: unknown): VitalsRecord[] => {
  if (response && typeof response === 'object' && 'success' in response && response.success !== true) {
    throw new Error('The vitals service reported an unsuccessful response.');
  }

  const records = response && typeof response === 'object' && 'data' in response
    ? response.data
    : null;
  if (!Array.isArray(records) || records.some((record) =>
    !record || typeof record !== 'object'
    || !('vitalsId' in record) || typeof record.vitalsId !== 'string'
    || !('patientId' in record) || typeof record.patientId !== 'string'
    || !('recordedAt' in record) || typeof record.recordedAt !== 'string'
    || !Number.isFinite(Date.parse(record.recordedAt))
  )) {
    throw new Error('The vitals service returned an invalid history response.');
  }
  return records as VitalsRecord[];
};

export const fetchPatientVitals = async (patientId: string): Promise<VitalsRecord[]> => {
  if (!patientId.trim()) throw new Error('A patient ID is required to load vitals.');
  const response = await api.get(`/vitals?patientId=${encodeURIComponent(patientId)}`, { skipToast: true });
  return parseVitalsResponse(response);
};
