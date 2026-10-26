// Shows patient details and the newest rule-based vitals report.
import React, { useRef, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Calendar, User, Activity, AlertTriangle, CircleCheck } from 'lucide-react';
import api from '../../shared/services/api';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import { VoiceButton } from '../molecules/VoiceButton';
import { useVoiceStore } from '../../store/voiceStore';
import { buildVitalsSummary } from '../../shared/utils/buildVitalsSummary';
import { fetchPatientVitals } from '../../shared/services/vitals';

interface PatientDetails {
  patientId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
}

interface PatientVitals {
  vitalsId: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  sugarLevel?: number;
  temperature?: number;
  heartRate?: number;
  pulseRate?: number;
  rbcCount?: number;
  wbcCount?: number;
  recordedAt: string;
  analysis?: {
    status?: 'normal' | 'warning' | 'critical' | 'inconclusive';
    flaggedParams?: string[];
    message?: string;
    details?: unknown;
    trendNotes?: unknown;
    rangesUsed?: unknown;
  };
}

export const PatientDetailPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestVitals, setLatestVitals] = useState<PatientVitals | null>(null);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [vitalsError, setVitalsError] = useState<string | null>(null);
  const language = useVoiceStore((state) => state.language);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setError('A patient ID is required to open this record.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      setPatient(null);
      try {
        const response = await api.get(`/patients/${encodeURIComponent(patientId)}`, { skipToast: true }) as {
          success?: boolean;
          data?: PatientDetails;
        };
        if (response.success !== true || !response.data || response.data.patientId !== patientId) {
          throw new Error('The patient service returned an invalid patient profile.');
        }
        if (!cancelled) setPatient(response.data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load patient details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetch();
    return () => { cancelled = true; };
  }, [patientId]);

  // Load this patient's latest vitals without changing the existing patient API.
  useEffect(() => {
    if (!patient?.patientId) return;
    let cancelled = false;
    const fetchLatestVitals = async () => {
      setVitalsLoading(true);
      setVitalsError(null);
      try {
        const records = await fetchPatientVitals(patient.patientId);
        records.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
        if (!cancelled) setLatestVitals(records[0] || null);
      } catch (err: unknown) {
        if (!cancelled) {
          setLatestVitals(null);
          setVitalsError(err instanceof Error ? err.message : 'Could not load the latest vitals report.');
        }
      } finally {
        if (!cancelled) setVitalsLoading(false);
      }
    };
    void fetchLatestVitals();
    return () => {
      cancelled = true;
    };
  }, [patient?.patientId]);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  return (
    <DashboardLayout>
      <div ref={containerRef}>
        <div className="max-w-3xl mx-auto">
          <Link to="/patients" className="inline-flex items-center text-xs font-semibold text-textSecondary hover:text-textPrimary mb-4">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Patients List
          </Link>
          {loading && <div className="flex items-center justify-center py-20 text-primary"><Spinner size="lg" /><span className="ml-3 text-sm text-textSecondary">Loading patient record...</span></div>}
          {!loading && error && <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-md text-sm">{error}</div>}
          {!loading && !error && !patient && (
            <div className="p-8 text-center text-textSecondary text-sm">No patient data found.</div>
          )}
          {!loading && patient && (
            <>
              <Card>
                <div className="flex justify-end mb-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      to={`/vitals/history?patientId=${encodeURIComponent(patient.patientId)}`}
                      className="inline-flex items-center rounded-md bg-prescriptionPrimary px-4 py-2 text-sm font-medium text-surface hover:bg-prescriptionPrimaryDark"
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      View Vitals History
                    </Link>
                    <Link
                      to={`/prescriptions/patient/${encodeURIComponent(patient.patientId)}`}
                      className="inline-flex items-center rounded-md border border-textPrimary/10 bg-surface px-4 py-2 text-sm font-medium text-textPrimary hover:bg-background"
                    >
                      View Prescriptions
                    </Link>
                    <Link
                      to={`/prescriptions/new?patientId=${encodeURIComponent(patient.patientId)}`}
                      className="inline-flex items-center rounded-md bg-prescriptionPrimary px-4 py-2 text-sm font-medium text-surface hover:bg-prescriptionPrimaryDark"
                    >
                      Create Prescription
                    </Link>
                  </div>
                </div>
                <div className="flex items-center space-x-4 pb-6 border-b border-border">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-textPrimary">{patient.fullName || `${patient.firstName} ${patient.lastName}`}</h1>
                    <p className="text-xs text-textSecondary mt-0.5">Patient ID: <span className="font-mono text-textPrimary">{patient.patientId}</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  <div className="flex items-start space-x-3">
                    <Mail className="w-5 h-5 text-textSecondary shrink-0 mt-0.5" />
                    <div><p className="text-xs font-semibold uppercase text-textSecondary">Email</p><p className="text-sm font-medium text-textPrimary">{patient.email}</p></div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Phone className="w-5 h-5 text-textSecondary shrink-0 mt-0.5" />
                    <div><p className="text-xs font-semibold uppercase text-textSecondary">Phone Number</p><p className="text-sm font-medium text-textPrimary">{patient.phone || 'Not provided'}</p></div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Calendar className="w-5 h-5 text-textSecondary shrink-0 mt-0.5" />
                    <div><p className="text-xs font-semibold uppercase text-textSecondary">Date of Birth</p><p className="text-sm font-medium text-textPrimary">{patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'Not provided'}</p></div>
                  </div>
                </div>
              </Card>
              <Card title="Latest condition" className="mt-4 rounded-md border-textPrimary/10 bg-surface shadow-sm">
                {vitalsLoading && <p className="text-sm text-textPrimary/70">Loading latest vitals...</p>}
                {!vitalsLoading && vitalsError && (
                  <p role="alert" className="text-sm text-danger">{vitalsError}</p>
                )}
                {!vitalsLoading && !latestVitals && (
                  !vitalsError && <p className="text-sm text-textPrimary/70">No vitals report is available yet.</p>
                )}
                {!vitalsLoading && latestVitals && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {latestVitals.analysis?.status === 'critical'
                        ? <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
                        : latestVitals.analysis?.status === 'warning'
                          ? <Activity className="h-4 w-4 text-danger" aria-hidden="true" />
                          : latestVitals.analysis?.status === 'normal'
                            ? <CircleCheck className="h-4 w-4 text-voicePrimary" aria-hidden="true" />
                            : <Activity className="h-4 w-4 text-textPrimary" aria-hidden="true" />}
                      <span className="text-sm font-semibold text-textPrimary">
                        {latestVitals.analysis?.status || 'No analysis returned'}
                      </span>
                      <span className="text-xs text-textPrimary/70">
                        {new Date(latestVitals.recordedAt).toLocaleString()}
                      </span>
                      <VoiceButton
                        text={buildVitalsSummary(
                          patient.fullName || `${patient.firstName} ${patient.lastName}`,
                          latestVitals,
                          latestVitals.analysis || {},
                          language
                        )}
                        englishText={buildVitalsSummary(
                          patient.fullName || `${patient.firstName} ${patient.lastName}`,
                          latestVitals,
                          latestVitals.analysis || {},
                          'en'
                        )}
                      />
                    </div>
                    <p className="text-sm text-textPrimary">
                      {buildVitalsSummary(
                        patient.fullName || `${patient.firstName} ${patient.lastName}`,
                        latestVitals,
                        latestVitals.analysis || {},
                        language
                      )}
                    </p>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
