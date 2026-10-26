import React, { useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import api from '../../shared/services/api';
import { fetchPatientVitals, type VitalsRecord } from '../../shared/services/vitals';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

export const PatientVitalsPage: React.FC = () => {
  const [records, setRecords] = useState<VitalsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchMyVitals = async () => {
      try {
        setLoading(true);
        setError(null);
        const profileResponse = await api.get('/patients/me') as {
          data?: { patientId?: string };
        };
        const patientId = profileResponse.data?.patientId;
        if (!patientId) {
          throw new Error('No patient profile is linked to your account.');
        }

        const vitals = await fetchPatientVitals(patientId);
        if (!cancelled) setRecords(vitals);
      } catch (err: unknown) {
        if (!cancelled) {
          setRecords([]);
          setError(err instanceof Error ? err.message : 'Failed to load your vitals');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchMyVitals();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
              <Activity className="w-3.5 h-3.5" />
              <span>Biometric Records</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-textPrimary">My Vitals</h1>
            <p className="text-sm text-textSecondary mt-1">
              Review your personal recorded vital signs, telemetry measurements, and automated health reports.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            aria-label="Refresh my vitals"
            className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-background hover:border-primary/50 disabled:opacity-60 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 text-primary ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-surface border border-border/50 rounded-2xl">
            <Spinner size="lg" />
            <span className="mt-3 text-sm font-medium text-textSecondary">Loading your biometric data...</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && records.length === 0 && (
          <div className="py-16 text-center bg-surface border border-dashed border-border rounded-2xl">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-textPrimary">No Vitals Recorded Yet</h3>
            <p className="text-xs text-textSecondary mt-1 max-w-sm mx-auto">
              You do not have any vitals on record. They will appear here automatically when checked during your next visit or scan.
            </p>
          </div>
        )}

        {/* Records Feed */}
        {!loading && !error && records.length > 0 && (
          <div className="space-y-4">
            {records.map((record) => {
              const status = record.analysis?.status;
              const isCritical = status === 'critical';
              const isWarning = status === 'warning';
              const isNormal = status === 'normal';

              return (
                <div
                  key={record.vitalsId}
                  className={`bg-surface border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 ${
                    isCritical
                      ? 'border-red-300 dark:border-red-900/60 ring-1 ring-red-400/20'
                      : isWarning
                      ? 'border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-400/20'
                      : 'border-border/80 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isCritical
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : isWarning
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                              isCritical
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                : isWarning
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : isNormal
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {status || (record.selectedMetrics ? 'Biometric Scan' : 'Routine Entry')}
                          </span>
                          <span className="text-xs font-medium text-textSecondary">
                            {new Date(record.recordedAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Metric Tiles */}
                  <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {record.selectedMetrics?.length ? (
                      <>
                        {record.selectedMetrics.includes('heartRate') && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Heart Rate</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.heartRate ?? '—'} <span className="text-[10px] font-normal text-textSecondary">bpm</span>
                            </span>
                          </div>
                        )}
                        {record.selectedMetrics.includes('breathingRate') && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Breathing Rate</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.breathingRate ?? '—'} <span className="text-[10px] font-normal text-textSecondary">br/min</span>
                            </span>
                          </div>
                        )}
                        {record.selectedMetrics.includes('hrv') && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Stress / HRV</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.hrv ?? '—'}
                            </span>
                          </div>
                        )}
                        {record.spo2 !== undefined && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">SpO2 Oxygen</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.spo2}%
                            </span>
                          </div>
                        )}
                        {record.bloodPressure && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Blood Pressure</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.bloodPressure.systolic}/{record.bloodPressure.diastolic} <span className="text-[10px] font-normal text-textSecondary">mmHg</span>
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {record.bloodPressureSystolic !== undefined && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Blood Pressure</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.bloodPressureSystolic}/{record.bloodPressureDiastolic} <span className="text-[10px] font-normal text-textSecondary">mmHg</span>
                            </span>
                          </div>
                        )}
                        {record.heartRate !== undefined && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Heart Rate</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.heartRate} <span className="text-[10px] font-normal text-textSecondary">bpm</span>
                            </span>
                          </div>
                        )}
                        {record.pulseRate !== undefined && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Pulse Rate</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.pulseRate} <span className="text-[10px] font-normal text-textSecondary">bpm</span>
                            </span>
                          </div>
                        )}
                        {record.sugarLevel !== undefined && (
                          <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                            <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Blood Sugar</span>
                            <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                              {record.sugarLevel} <span className="text-[10px] font-normal text-textSecondary">mg/dL</span>
                            </span>
                          </div>
                        )}
                        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                          <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Temperature</span>
                          <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                            {record.temperature ?? '—'} <span className="text-[10px] font-normal text-textSecondary">°F</span>
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                          <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">RBC Count</span>
                          <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                            {record.rbcCount ?? '—'} <span className="text-[10px] font-normal text-textSecondary">M/µL</span>
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                          <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">WBC Count</span>
                          <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                            {record.wbcCount ?? '—'} <span className="text-[10px] font-normal text-textSecondary">cells/µL</span>
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {record.analysis?.message && (
                    <p className="mt-3 text-xs sm:text-sm font-medium text-textPrimary leading-relaxed bg-background/60 p-3 rounded-xl border border-border/40">
                      {record.analysis.message}
                    </p>
                  )}

                  {record.analysis?.flaggedParams && record.analysis.flaggedParams.length > 0 && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                      <span>Flagged Parameters: {record.analysis.flaggedParams.join(', ')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
