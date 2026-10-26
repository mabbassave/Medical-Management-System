import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardPlus, Calendar } from 'lucide-react';
import api from '../../shared/services/api';
import { parseAuthorizedPatients } from '../../shared/services/patients';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import type { LabReport } from '../../shared/types';

interface PatientOption {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export const LabReportListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedPatientId = searchParams.get('patientId') || '';
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [reports, setReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const list = parseAuthorizedPatients(await api.get('/patients', { skipToast: true }));
        setPatients(list);
        const requestedPatient = list.find((patient) => patient.patientId === requestedPatientId);
        if (list.length > 0) setSelectedPatientId(requestedPatient?.patientId || list[0].patientId);
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : 'Failed to load patients.');
      } finally {
        setLoadingPatients(false);
      }
    };
    void fetchPatients();
  }, [requestedPatientId]);

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }

    let cancelled = false;
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        setReports([]);
        const response = await api.get(
          `/lab-reports/patient/${encodeURIComponent(selectedPatientId)}`,
          { skipToast: true }
        ) as { success?: boolean; reports?: LabReport[] };
        if (response.success !== true || !Array.isArray(response.reports)) {
          throw new Error('The lab reports service returned an invalid list response.');
        }
        if (!cancelled) setReports(response.reports);
      } catch (error: unknown) {
        if (!cancelled) {
          setReports([]);
          setError(error instanceof Error ? error.message : 'Failed to fetch lab reports.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchReports();
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading, loadingPatients]);
  const selectedPatient = patients.find((patient) => patient.patientId === selectedPatientId);
  const selectedPatientName = selectedPatient?.fullName
    || [selectedPatient?.firstName, selectedPatient?.lastName].filter(Boolean).join(' ')
    || '';

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Diagnostic Lab Reports</h1>
            <p className="mt-1 text-sm text-textSecondary">Laboratory test analyses, diagnostic findings, and clinical pathology notes.</p>
          </div>
          <Link
            to="/lab-reports/upload"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all"
          >
            <ClipboardPlus className="h-3.5 w-3.5" />
            Upload Lab Report
          </Link>
        </div>

        <div className="mb-6 max-w-sm">
          <label htmlFor="reportPatient" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-textSecondary">
            Select Patient
          </label>
          <select
            id="reportPatient"
            value={selectedPatientId}
            onChange={(event) => setSelectedPatientId(event.target.value)}
            disabled={loadingPatients || patients.length === 0}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs disabled:opacity-50"
          >
            {patients.map((patient) => (
              <option key={patient.patientId} value={patient.patientId}>
                {(patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`).trim()
                  || 'Unnamed Patient'}
              </option>
            ))}
          </select>
        </div>

        {selectedPatientName && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-xs font-semibold text-primary">
            <span>Patient:</span>
            <span className="text-textPrimary">{selectedPatientName}</span>
          </div>
        )}
        {!loadingPatients && error && (
          <div role="alert" className="mb-6 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-medium text-danger">
            {error}
          </div>
        )}

        {(loading || loadingPatients) && (
          <div className="flex items-center justify-center py-20 text-primary">
            <Spinner size="lg" />
            <span className="ml-3 text-sm font-medium text-textSecondary">Loading lab reports...</span>
          </div>
        )}

        {!loading && !loadingPatients && !error && patients.length === 0 && (
          <Card className="rounded-2xl border border-border bg-surface p-12 text-center shadow-card">
            <p className="text-sm font-medium text-textSecondary">No assigned patients are available.</p>
          </Card>
        )}

        {!loading && !loadingPatients && !error && selectedPatientId && reports.length === 0 && (
          <Card className="rounded-2xl border border-border bg-surface p-12 text-center shadow-card">
            <p className="text-sm font-semibold text-textPrimary">No lab reports yet for this patient</p>
            <p className="text-xs text-textSecondary mt-1">Uploaded clinical lab results will appear here.</p>
          </Card>
        )}

        {!loading && !loadingPatients && !error && reports.length > 0 && (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report._id} className="rounded-2xl border border-border bg-surface p-6 shadow-card hover:shadow-card-hover transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <h2 className="text-base font-bold text-textPrimary">{report.testName}</h2>
                  </div>
                  <span className="text-xs font-medium text-textSecondary flex items-center gap-1.5 bg-background px-3 py-1 rounded-full border border-border">
                    <Calendar className="h-3.5 w-3.5 text-textMuted" />
                    {new Date(report.uploadedAt).toLocaleString()}
                  </span>
                </div>
                <div className="bg-background p-4 rounded-xl border border-border">
                  <p className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-1.5">Diagnostic Findings & Results</p>
                  <p className="whitespace-pre-wrap text-sm text-textPrimary leading-relaxed">{report.result}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
