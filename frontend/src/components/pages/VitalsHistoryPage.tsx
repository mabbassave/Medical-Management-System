// Reviews previous vitals readings and their returned analysis.
import React, { useRef, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle, Activity, AlertTriangle, CircleCheck } from 'lucide-react';
import api from '../../shared/services/api';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import { VoiceButton } from '../molecules/VoiceButton';
import { useVoiceStore } from '../../store/voiceStore';
import { buildVitalsSummary } from '../../shared/utils/buildVitalsSummary';

interface Vitals {
  vitalsId: string;
  patientId: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  sugarLevel: number;
  temperature: number;
  pulseRate: number;
  rbcCount: number;
  wbcCount: number;
  recordedAt: string;
  analysis?: {
    status?: 'normal' | 'warning' | 'critical';
    flaggedParams?: string[];
    message?: string;
    details?: unknown;
    trendNotes?: unknown;
    rangesUsed?: unknown;
  };
}

export const VitalsHistoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [patientId, setPatientId] = useState(searchParams.get('patientId') || '');
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [patientName, setPatientName] = useState('Patient');
  const [loading, setLoading] = useState(Boolean(searchParams.get('patientId')));
  const [error, setError] = useState<string | null>(null);

  const fetchVitals = async (id: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) {
      setVitals([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/vitals/patient/${encodeURIComponent(trimmedId)}`) as {
        data?: Vitals[];
      };
      setVitals(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      setVitals([]);
      setError(err instanceof Error ? err.message : 'Failed to load vitals history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVitals(patientId);
  }, [patientId]);

  // Use the patient's name in every spoken and written reading summary.
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    const fetchPatient = async () => {
      try {
        const response = await api.get(`/patients/${encodeURIComponent(patientId)}`) as {
          data?: { fullName?: string; firstName?: string; lastName?: string };
        };
        const patient = response.data;
        if (!cancelled && patient) {
          setPatientName(patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient');
        }
      } catch {
        if (!cancelled) setPatientName('Patient');
      }
    };
    void fetchPatient();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const language = useVoiceStore((state) => state.language);
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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-textPrimary">Vitals History</h1>
            <p className="text-sm text-textSecondary mt-1">Review patient vital signs, telemetry trends, and automated clinical alerts.</p>
          </div>
          <Link
            to="/vitals"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-primary to-teal-600 hover:from-primary-hover hover:to-teal-700 px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record New Vitals</span>
          </Link>
        </div>

        {/* Patient Search / Filter Bar */}
        <div className="bg-surface border border-border/80 rounded-2xl p-4 shadow-sm">
          <label htmlFor="patient-id-input" className="block text-xs font-bold uppercase tracking-wider text-textSecondary mb-2">
            Patient Lookup
          </label>
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <div className="relative flex-1">
              <input
                id="patient-id-input"
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="Enter Patient ID (e.g. PAT-1001)..."
                className="w-full pl-3.5 pr-4 py-2.5 text-sm bg-background border border-border rounded-xl text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              onClick={() => fetchVitals(patientId)}
              className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm transition-all active:scale-95"
            >
              Search
            </button>
          </div>
        </div>

        {/* Status / Loading states */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-surface border border-border/50 rounded-2xl">
            <Spinner size="lg" />
            <span className="mt-3 text-sm font-medium text-textSecondary">Fetching vitals history...</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && !patientId && (
          <div className="py-14 text-center bg-surface border border-dashed border-border rounded-2xl">
            <Activity className="w-10 h-10 mx-auto text-primary/40 mb-2" />
            <h3 className="text-sm font-bold text-textPrimary">No Patient Selected</h3>
            <p className="text-xs text-textSecondary mt-1">Enter a patient ID above to inspect historical biometric readings.</p>
          </div>
        )}

        {!loading && vitals.length === 0 && patientId && !error && (
          <div className="py-14 text-center bg-surface border border-dashed border-border rounded-2xl">
            <Activity className="w-10 h-10 mx-auto text-textSecondary/40 mb-2" />
            <h3 className="text-sm font-bold text-textPrimary">No Records Found</h3>
            <p className="text-xs text-textSecondary mt-1">No vitals logs recorded yet for patient ID &ldquo;{patientId}&rdquo;.</p>
          </div>
        )}

        {/* Vitals Feed */}
        {!loading && vitals.length > 0 && (
          <div className="space-y-4">
            {vitals.map((v) => {
              const isCritical = v.analysis?.status === 'critical';
              const isWarning = v.analysis?.status === 'warning';
              const isNormal = v.analysis?.status === 'normal';

              return (
                <div
                  key={v.vitalsId}
                  className={`bg-surface border rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
                    isCritical
                      ? 'border-red-300 dark:border-red-900/60 ring-1 ring-red-400/20'
                      : isWarning
                      ? 'border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-400/20'
                      : 'border-border/80 hover:border-primary/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/40">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          isCritical
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : isWarning
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Activity className="w-4 h-4" />
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
                            {isCritical && <AlertTriangle className="w-3 h-3" />}
                            {isNormal && <CircleCheck className="w-3 h-3" />}
                            {v.analysis?.status || 'Routine Entry'}
                          </span>
                          <span className="text-xs font-medium text-textSecondary">
                            {new Date(v.recordedAt).toLocaleString(undefined, {
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

                    {v.analysis && (
                      <div className="self-start sm:self-auto">
                        <VoiceButton
                          text={buildVitalsSummary(patientName, v, v.analysis, language)}
                          englishText={buildVitalsSummary(patientName, v, v.analysis, 'en')}
                        />
                      </div>
                    )}
                  </div>

                  {/* Summary commentary */}
                  {v.analysis && (
                    <p className="mt-3 text-xs sm:text-sm font-medium text-textPrimary leading-relaxed bg-background/60 p-3 rounded-xl border border-border/40">
                      {buildVitalsSummary(patientName, v, v.analysis, language)}
                    </p>
                  )}

                  {/* Telemetry Metric Tiles */}
                  <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Blood Pressure</span>
                      <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                        {v.bloodPressureSystolic}/{v.bloodPressureDiastolic} <span className="text-[10px] font-normal text-textSecondary">mmHg</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Heart Rate</span>
                      <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                        {v.heartRate} <span className="text-[10px] font-normal text-textSecondary">bpm</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Pulse Rate</span>
                      <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                        {v.pulseRate} <span className="text-[10px] font-normal text-textSecondary">bpm</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Blood Sugar</span>
                      <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                        {v.sugarLevel} <span className="text-[10px] font-normal text-textSecondary">mg/dL</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Temperature</span>
                      <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                        {v.temperature} <span className="text-[10px] font-normal text-textSecondary">°F</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">RBC Count</span>
                      <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                        {v.rbcCount} <span className="text-[10px] font-normal text-textSecondary">M/µL</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">WBC Count</span>
                      <span className="text-sm font-extrabold text-textPrimary mt-0.5 block">
                        {v.wbcCount} <span className="text-[10px] font-normal text-textSecondary">cells/µL</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                      <span className="block text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Status Note</span>
                      <span className="text-xs font-bold text-textPrimary mt-0.5 block truncate">
                        {v.analysis?.status ?? 'Logged'}
                      </span>
                    </div>
                  </div>

                  {v.analysis?.message && (
                    <p className="text-xs text-textSecondary mt-2.5 font-medium">{v.analysis.message}</p>
                  )}

                  {v.analysis?.flaggedParams && v.analysis.flaggedParams.length > 0 && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Flagged Parameters: {v.analysis.flaggedParams.join(', ')}</span>
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
