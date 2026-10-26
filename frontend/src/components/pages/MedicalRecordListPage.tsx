import React, { useRef,  useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePlus, Calendar, AlertOctagon, User } from 'lucide-react';

import api from '../../shared/services/api';
import { fetchAuthorizedPatients } from '../../shared/services/patients';
import { parsePatientPortalList } from '../../shared/services/patientPortal';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface MedicalRecord {
  recordId: string;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  diagnosis: string;
  notes: string;
  allergies: string[];
  createdAt: string;
}

interface Patient {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

interface Doctor { doctorId: string; firstName?: string; lastName?: string; fullName?: string; specialization?: string; }

export const MedicalRecordListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedPatientId = searchParams.get('patientId') || '';
  const user = useAuthStore((state) => state.user);
  const isDoctor = user?.role.toLowerCase() === 'doctor';
  const isPatient = user?.role.toLowerCase() === 'patient';
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctorNamesError, setDoctorNamesError] = useState<string | null>(null);
  const [doctorMap, setDoctorMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    const fetchInitialData = async () => {
      const patientsRequest = isPatient
        ? api.get('/patients/me', { skipToast: true }).then((response) => {
            const patient = response && typeof response === 'object' && 'data' in response
              ? response.data as Patient
              : null;
            if (!patient || typeof patient.patientId !== 'string') {
              throw new Error('No patient profile is linked to this account.');
            }
            return [patient];
          })
        : fetchAuthorizedPatients();
      const [patientsResult, doctorsResult] = await Promise.allSettled([
        patientsRequest,
            api.get('/doctors', { skipToast: true }),
      ]);

      if (!active) return;

      if (patientsResult.status === 'fulfilled') {
        setPatients(patientsResult.value);
        const selectedPatient = patientsResult.value.find((patient) => patient.patientId === requestedPatientId);
        setSelectedPatientId(selectedPatient?.patientId || patientsResult.value[0]?.patientId || '');
      } else {
        setError(patientsResult.reason instanceof Error
          ? patientsResult.reason.message
          : 'Failed to load authorized patients.');
      }

      if (doctorsResult.status === 'fulfilled') {
        try {
          const docList = parsePatientPortalList<Doctor>(doctorsResult.value, 'doctors');
          const map = new Map<string, string>();
          docList.forEach((doctor) => {
            const name = doctor.fullName || `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || 'Unknown Doctor';
            const label = doctor.specialization ? `${name} (${doctor.specialization})` : name;
            map.set(doctor.doctorId, label);
          });
          setDoctorMap(map);
        } catch (err: unknown) {
          setDoctorNamesError(err instanceof Error ? err.message : 'The doctors service returned an invalid list response.');
        }
      } else {
        setDoctorNamesError(doctorsResult.reason instanceof Error
          ? doctorsResult.reason.message
          : 'Failed to load doctors.');
      }
      setLoadingPatients(false);
    };

    void fetchInitialData();
    return () => {
      active = false;
    };
  }, [isPatient, requestedPatientId]);

  useEffect(() => {
    if (!selectedPatientId) return;
    let active = true;

    const fetchRecords = async () => {
      try {
        setLoading(true);
        setError(null);
        setRecords([]);
        const res: any = await api.get(
          `/medical-records/patient/${encodeURIComponent(selectedPatientId)}`,
          { skipToast: true }
        );
        const data = parsePatientPortalList<MedicalRecord>(res, 'medical records');
        if (active) setRecords(data);
      } catch (err: unknown) {
        if (active) {
          setRecords([]);
          setError(err instanceof Error ? err.message : 'Failed to load medical records.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchRecords();
    return () => {
      active = false;
    };
  }, [selectedPatientId]);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading, loadingPatients]);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Medical Records (EMR)</h1>
            <p className="text-sm text-textSecondary mt-1">
              Electronic health histories, diagnoses, allergies, and physician notes.
            </p>
          </div>

          {isDoctor && (
            <Link
              to="/medical-records/new"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl transition-all shadow-xs"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Add Medical Record
            </Link>
          )}
        </div>

        <div className="mb-6 max-w-sm">
          <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
            Select Patient
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={loadingPatients || patients.length === 0}
            className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-textPrimary font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 shadow-xs"
          >
            {patients.length === 0 ? (
              <option value="">
                {loadingPatients ? 'Loading authorized patients...' : error ? 'Patients unavailable' : 'No assigned patients'}
              </option>
            ) : patients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {(p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim() || 'Unnamed Patient'}
                </option>
              ))}
          </select>
        </div>

        {loadingPatients && (
          <div className="flex items-center justify-center py-12 text-primary">
            <Spinner size="lg" />
            <span className="ml-3 text-sm font-medium text-textSecondary">Loading patients...</span>
          </div>
        )}
        {!loadingPatients && error && (
          <div role="alert" className="mb-6 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-medium text-danger">
            {error}
          </div>
        )}
        {!loadingPatients && !error && doctorNamesError && (
          <div role="status" className="mb-6 rounded-xl border border-warning/20 bg-warning/10 p-4 text-xs font-medium text-textSecondary">
            Medical records are available, but doctor names could not be loaded: {doctorNamesError}
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-16 text-primary">
            <Spinner size="lg" />
            <span className="ml-3 text-sm font-medium text-textSecondary">Loading medical history...</span>
          </div>
        )}

        {!loading && !loadingPatients && !error && patients.length === 0 && (
          <Card className="rounded-2xl border border-border bg-surface p-12 text-center shadow-card">
            <p className="text-sm font-medium text-textSecondary">No assigned patients are available.</p>
          </Card>
        )}

        {!loading && !loadingPatients && !error && selectedPatientId && (
          <div className="space-y-4">
            {records.length === 0 ? (
              <Card className="rounded-2xl border border-border bg-surface p-12 text-center shadow-card">
                <p className="text-sm font-semibold text-textPrimary">No medical records found</p>
                <p className="text-xs text-textSecondary mt-1">There are no documented health incidents for this patient yet.</p>
              </Card>
            ) : (
              records.map((rec) => (
                <Card key={rec.recordId} className="rounded-2xl border border-border bg-surface p-6 shadow-card hover:shadow-card-hover transition-all space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3.5">
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-textPrimary">
                        {rec.diagnosis}
                      </h3>
                      <p className="text-xs text-textSecondary flex items-center gap-1.5 mt-1">
                        <User className="w-3.5 h-3.5 text-primary" /> Doctor: <span className="font-semibold text-textPrimary">{rec.doctorName || doctorMap.get(rec.doctorId) || rec.doctorId}</span>
                      </p>
                    </div>
                    <span className="text-xs font-medium text-textSecondary flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-lg border border-border self-start sm:self-auto">
                      <Calendar className="w-3.5 h-3.5 text-textMuted" />
                      {new Date(rec.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {rec.allergies && rec.allergies.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-danger flex items-center gap-1.5 uppercase tracking-wider">
                        <AlertOctagon className="w-3.5 h-3.5" /> Allergies:
                      </span>
                      {rec.allergies.map((allergy, i) => (
                        <span
                          key={i}
                          className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-medium"
                        >
                          {allergy}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="bg-background p-4 rounded-xl border border-border">
                    <p className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-1.5">
                      Doctor's Clinical Notes
                    </p>
                    <p className="text-sm text-textPrimary leading-relaxed whitespace-pre-line">
                      {rec.notes || 'No additional notes provided.'}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
