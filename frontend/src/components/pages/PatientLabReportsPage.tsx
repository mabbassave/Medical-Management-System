import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Download } from 'lucide-react';
import api from '../../shared/services/api';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import type { LabReport } from '../../shared/types';

export const PatientLabReportsPage: React.FC = () => {
  const [reports, setReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  useEffect(() => {
    let cancelled = false;

    const fetchMyLabReports = async () => {
      try {
        const profileResponse = await api.get('/patients/me') as {
          data?: { patientId?: string };
        };
        const patientId = profileResponse.data?.patientId;
        if (!patientId) throw new Error('No patient profile is linked to your account.');

        const response = await api.get(
          `/lab-reports/patient/${encodeURIComponent(patientId)}`,
          { skipToast: true }
        ) as { success?: boolean; reports?: LabReport[] };
        if (response.success !== true || !Array.isArray(response.reports)) {
          throw new Error('The lab reports service returned an invalid list response.');
        }
        if (!cancelled) {
          setReports(response.reports);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load your lab reports.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchMyLabReports();
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadReport = (report: LabReport) => {
    const date = new Date(report.uploadedAt).toLocaleString();
    const contents = `Test Name: ${report.testName}\nDate: ${date}\n\nResult/Notes:\n${report.result}\n`;
    const file = new Blob([contents], { type: 'text/plain;charset=utf-8' });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    const safeTestName = report.testName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    link.href = fileUrl;
    link.download = `lab-report-${safeTestName || 'report'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 0);
  };

  return (
    <DashboardLayout>
      <div ref={containerRef} className="space-y-6">
        {/* Header */}
        <div className="pb-2 border-b border-border/40">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Diagnostic Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-textPrimary">My Lab Reports</h1>
          <p className="mt-1 text-sm text-textSecondary">
            Access, view, and securely download your laboratory test results and clinical findings.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-surface border border-border/50 rounded-2xl">
            <Spinner size="lg" />
            <span className="mt-3 text-sm font-medium text-textSecondary">Retrieving your lab records...</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-medium text-danger">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && reports.length === 0 && (
          <div className="py-16 text-center bg-surface border border-dashed border-border rounded-2xl">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-textPrimary">No Lab Reports Available</h3>
            <p className="text-xs text-textSecondary mt-1 max-w-sm mx-auto">
              You do not have any published laboratory findings on record yet. Once your clinician uploads them, they will appear here.
            </p>
          </div>
        )}

        {/* Reports Feed */}
        {!loading && !error && reports.length > 0 && (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report._id}
                className="bg-surface border border-border/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                        Laboratory Result
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-textSecondary">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(report.uploadedAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-textPrimary tracking-tight">
                      {report.testName}
                    </h2>

                    <div className="mt-3 p-4 rounded-xl bg-background/80 border border-border/60">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-textSecondary mb-1.5">
                        Clinical Result & Notes
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-textPrimary font-mono leading-relaxed">
                        {report.result}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadReport(report)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download TXT</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
