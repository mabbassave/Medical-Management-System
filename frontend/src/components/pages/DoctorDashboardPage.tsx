import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import api from '../../shared/services/api';
import { fetchAuthorizedPatients } from '../../shared/services/patients';
import { parsePatientPortalList } from '../../shared/services/patientPortal';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Badge } from '../atoms/Badge';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  appointmentId: string;
  patientId: string;
  appointmentDate: string;
  notes?: string;
  status: string;
}

interface CriticalAlert {
  patientId: string;
  patientName: string;
  detail: string;
}

interface Doctor {
  doctorId: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  status?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDoctorName = (d: Doctor): string => {
  return d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Dr. Unknown';
};

const getDoctorInitials = (name: string): string => {
  const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(' ');
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
};

const getPatientName = (
  p: Appointment['patientId'],
  fallback = 'Unknown Patient'
): string => {
  if (typeof p === 'string') return fallback;
  const obj = p as { fullName?: string; firstName?: string; lastName?: string };
  return (
    obj.fullName ||
    `${obj.firstName || ''} ${obj.lastName || ''}`.trim() ||
    fallback
  );
};

const getPatientRawId = (p: Appointment['patientId']): string => {
  if (typeof p === 'string') return p;
  return (p as { _id?: string })._id ?? '';
};

const isToday = (dateStr: string): boolean => {
  const today = new Date();
  const d = new Date(dateStr);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

const statusVariant = (status: string): 'success' | 'warning' | 'danger' => {
  if (status.toLowerCase() === 'completed') return 'success';
  if (['cancelled', 'missed'].includes(status.toLowerCase())) return 'danger';
  return 'warning';
};

export const DoctorDashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [patientNames, setPatientNames] = useState<Map<string, string>>(new Map());
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  // Step 1 — fetch this doctor's appointments
  useEffect(() => {
    if (user?.role.toLowerCase() !== 'doctor') {
      setAppointmentsError('You are not authorized to view this dashboard.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchAppointments = async () => {
      setLoading(true);
      setAppointmentsError(null);
      try {
        const profileResponse = await api.get('/doctors/me', { skipToast: true }) as {
          data?: { doctorId?: string };
        };
        const doctorId = profileResponse.data?.doctorId;
        if (!doctorId) {
          throw new Error('No doctor profile is linked to your account. Please contact an administrator.');
        }

        const response = await api.get(`/appointments/doctor/${encodeURIComponent(doctorId)}`, { skipToast: true });
        if (!cancelled) {
          setAllAppointments(parsePatientPortalList<Appointment>(response, 'appointments'));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setAllAppointments([]);
          setAppointmentsError(error instanceof Error ? error.message : 'Failed to load appointments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchAppointments();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    let cancelled = false;
    const loadDashboardPatients = async () => {
      setPatientsError(null);
      try {
        const patients = await fetchAuthorizedPatients();
        if (cancelled) return;
        setPatientNames(new Map(patients.map((patient) => [
          patient.patientId,
          patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.patientId,
        ])));
      } catch (error: unknown) {
        if (!cancelled) {
          setPatientsError(error instanceof Error ? error.message : 'Failed to load patient details.');
        }
      }
    };
    void loadDashboardPatients();
    return () => { cancelled = true; };
  }, []);

  // Step 1b — fetch real doctors for Clinical Care Team
  useEffect(() => {
    let cancelled = false;
    const fetchDoctors = async () => {
      try {
        const res = await api.get('/doctors', { skipToast: true }) as { data?: Doctor[] } | Doctor[];
        if (!cancelled) {
          const list = Array.isArray(res) ? res : ((res as { data?: Doctor[] }).data ?? []);
          setDoctors(list.slice(0, 6));
        }
      } catch {
        // silently ignore — section will show empty state
      }
    };
    void fetchDoctors();
    return () => { cancelled = true; };
  }, []);

  // Step 2 — scan vitals for critical alerts
  useEffect(() => {
    if (allAppointments.length === 0) {
      setCriticalAlerts([]);
      setAlertsError(null);
      setAlertsLoading(false);
      return;
    }

    let cancelled = false;
    const uniquePatientIds = Array.from(
      new Set(allAppointments.map((appointment) => getPatientRawId(appointment.patientId)))
    ).filter(Boolean);

    if (uniquePatientIds.length === 0) {
      setCriticalAlerts([]);
      setAlertsError(null);
      setAlertsLoading(false);
      return;
    }

    const checkCriticalVitals = async () => {
      setAlertsLoading(true);
      setAlertsError(null);
      try {
        const alertPromises = uniquePatientIds.map(async (rawId) => {
          try {
            const res = await api.get(`/vitals/patient/${encodeURIComponent(rawId)}`, {
              skipToast: true,
            });
            const records = (
              Array.isArray(res)
                ? res
                : (res as { data?: unknown[] }).data || []
            ) as Array<{
              heartRate?: number;
              bloodPressureSystolic?: number;
              bloodPressureDiastolic?: number;
              status?: string;
              analysis?: { status?: string; message?: string };
            }>;

            if (records.length === 0) return null;
            const latest = records[0];
            const isCritical =
              latest.status?.toLowerCase() === 'critical' ||
              latest.analysis?.status?.toLowerCase() === 'critical' ||
              (latest.heartRate && (latest.heartRate > 120 || latest.heartRate < 45)) ||
              (latest.bloodPressureSystolic && latest.bloodPressureSystolic > 180);

            if (!isCritical) return null;

            return {
              patientId: rawId,
              patientName: patientNames.get(rawId) || rawId,
              detail:
                latest.analysis?.message ||
                `HR: ${latest.heartRate ?? '—'} bpm, BP: ${
                  latest.bloodPressureSystolic ?? '—'
                }/${latest.bloodPressureDiastolic ?? '—'}`,
            };
          } catch {
            return null;
          }
        });

        const results = await Promise.all(alertPromises);
        if (!cancelled) {
          setCriticalAlerts(
            results.filter((a): a is CriticalAlert => a !== null)
          );
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setAlertsError(
            err instanceof Error ? err.message : 'Failed to check patient vitals.'
          );
        }
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    };

    void checkCriticalVitals();
    return () => {
      cancelled = true;
    };
  }, [allAppointments, patientNames]);

  // Step 3 — calculate dashboard metrics
  const todaysAppointments = allAppointments.filter(
    (a) => a.appointmentDate && isToday(a.appointmentDate)
  );

  const uniquePatientCount = new Set(
    allAppointments.map((a) => getPatientRawId(a.patientId)).filter(Boolean)
  ).size;

  const appointmentStatusData = React.useMemo(() => {
    if (allAppointments.length === 0) return [];
    const counts = allAppointments.reduce<Record<string, number>>((acc, a) => {
      const s = (a.status || 'unknown').toLowerCase();
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const total = allAppointments.length;
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }, [allAppointments]);

  const recentActivity = allAppointments
    .filter((a) =>
      ['completed', 'cancelled', 'missed'].includes((a.status || '').toLowerCase())
    )
    .sort(
      (a, b) =>
        new Date(b.appointmentDate).getTime() -
        new Date(a.appointmentDate).getTime()
    )
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="space-y-8">
        
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-card">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Clinical Station Active
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Welcome, Dr. {user?.name || user?.username || 'Physician'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Here is an overview of your schedule, active patient cases, and critical alerts.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/prescriptions/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800 transition-all shadow-sm"
            >
              <FileText className="h-4 w-4" />
              New Prescription
            </Link>
            <Link
              to="/vitals"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-xs font-semibold text-white hover:bg-emerald-700 transition-all shadow-sm"
            >
              <Activity className="h-4 w-4" />
              Biometric Scan
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {appointmentsError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {appointmentsError}
              </div>
            )}
            {patientsError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Patient records notice: {patientsError}
              </div>
            )}

            {!appointmentsError && (
              <>
                {/* ── STATS CARDS: One solid green card + white cards with soft shadows ── */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  
                  {/* Card 1: Solid Soft Green Card */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-7 text-white shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-50 mb-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#EAB308]" />
                          Scheduled Today
                        </span>
                        <p className="text-sm font-medium text-emerald-100">Today's Appointments</p>
                        <p className="numeric text-4xl font-extrabold tracking-tight mt-1">
                          {todaysAppointments.length}
                        </p>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm">
                        <Calendar className="h-7 w-7" />
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-xs text-emerald-100">
                      <span>Live clinical queue</span>
                      <Link to="/appointments" className="font-semibold underline hover:text-white flex items-center gap-1">
                        View queue <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Card 2: White Card with Soft Green Accent */}
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-7 shadow-card hover:shadow-card-hover transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Total Caseload
                        </span>
                        <p className="text-sm font-medium text-slate-600">Assigned Patients</p>
                        <p className="numeric text-4xl font-extrabold tracking-tight text-slate-900 mt-1">
                          {uniquePatientCount}
                        </p>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/80">
                        <Users className="h-7 w-7" />
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                      <span>Unique medical charts</span>
                      <Link to="/patients" className="font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                        Patient directory <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Card 3: White Card with Alert/Status Indicator */}
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-7 shadow-card hover:shadow-card-hover transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Attention Required
                        </span>
                        <p className="text-sm font-medium text-slate-600">Critical Alerts</p>
                        <p className={`numeric text-4xl font-extrabold tracking-tight mt-1 ${criticalAlerts.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {criticalAlerts.length}
                        </p>
                      </div>
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                        criticalAlerts.length > 0
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}>
                        <AlertTriangle className="h-7 w-7" />
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                      <span>{criticalAlerts.length === 0 ? 'All vitals within safe thresholds' : 'Immediate review advised'}</span>
                      <span className={`font-semibold ${criticalAlerts.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {criticalAlerts.length === 0 ? 'Normal' : 'Action needed'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* ── TEAM / DOCTOR SECTION WITH REAL DATA ── */}
                <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Clinical Care Team</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Active medical staff and consulting physicians</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {doctors.length} {doctors.length === 1 ? 'Specialist' : 'Specialists'}
                    </span>
                  </div>

                  {doctors.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-6">No doctors found in the system.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      {doctors.map((doc) => {
                        const name = getDoctorName(doc);
                        const initials = getDoctorInitials(name);
                        const displayName = name.startsWith('Dr.') ? name : `Dr. ${name}`;
                        return (
                          <div key={doc.doctorId} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-5 transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:-translate-y-1">
                            <div className="flex flex-col items-center text-center">
                              <div className="relative mb-4">
                                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-xl font-extrabold border-2 border-white shadow-md">
                                  {initials}
                                </div>
                                <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white shadow-sm">
                                  <span className="h-2 w-2 rounded-full bg-white" />
                                </span>
                              </div>
                              <p className="text-sm font-bold text-slate-900">{displayName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{doc.specialty || 'General Practice'}</p>
                              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Available
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── MAIN CONTENT GRID: TODAY'S SCHEDULE + ALERTS/CHARTS ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Left Column: Today's Schedule (2 cols wide) */}
                  <div className="lg:col-span-2">
                    <Card
                      title="Today's Schedule"
                      subtitle={`${todaysAppointments.length} appointment${todaysAppointments.length !== 1 ? 's' : ''} scheduled for today`}
                    >
                      {todaysAppointments.length === 0 ? (
                        <div className="text-center py-12">
                          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-800">
                            No appointments scheduled for today.
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Your calendar is currently clear. Walk-ins can be registered anytime.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {todaysAppointments.map((appt) => (
                            <div
                              key={appt.appointmentId}
                              className="p-3.5 flex items-center justify-between gap-4 bg-slate-50/60 hover:bg-slate-50 border border-slate-100/90 rounded-2xl transition-all"
                            >
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="h-9 w-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs">
                                  <Clock className="w-4 h-4 text-emerald-600" />
                                </div>
                                <span className="text-sm font-bold text-slate-900 w-14">
                                  {new Date(appt.appointmentDate).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {patientNames.get(getPatientRawId(appt.patientId)) || getPatientName(appt.patientId)}
                                </p>
                                {appt.notes && (
                                  <p className="text-xs text-slate-500 truncate mt-0.5">{appt.notes}</p>
                                )}
                              </div>

                              <Badge
                                variant={statusVariant(appt.status)}
                                className="shrink-0 capitalize"
                              >
                                {appt.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Right Column: Alerts & Status Distribution Chart */}
                  <div className="flex flex-col gap-6">

                    {/* Critical Alerts Card */}
                    <Card
                      title="Critical Alerts"
                      subtitle="Patients requiring immediate follow-up"
                    >
                      {alertsLoading ? (
                        <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
                          <Spinner size="sm" />
                          Scanning telemetry…
                        </div>
                      ) : alertsError ? (
                        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                          {alertsError}
                        </div>
                      ) : criticalAlerts.length === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-800">All patients look stable.</p>
                          <p className="text-xs text-slate-500 mt-0.5">No critical deviations detected.</p>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {criticalAlerts.map((alert) => (
                            <li
                              key={alert.patientId}
                              className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5"
                            >
                              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-rose-900 truncate">
                                  {alert.patientName}
                                </p>
                                <p className="text-xs text-rose-700 mt-0.5">{alert.detail}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>

                    {/* Clean Status Distribution with Progress Bars */}
                    <Card
                      title="Appointment Status"
                      subtitle="Breakdown of clinical appointments"
                    >
                      {appointmentStatusData.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-500">
                          No appointment data recorded yet.
                        </p>
                      ) : (
                        <div className="space-y-3.5 pt-1">
                          {appointmentStatusData.map(({ status, count, percentage }) => (
                            <div key={status} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold capitalize text-slate-800">{status}</span>
                                <span className="font-semibold text-slate-500">{count} ({percentage}%)</span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                  </div>
                </div>

                {/* ── RECENT ACTIVITY TABLE ── */}
                <div className="mt-2">
                  <Card title="Recent Activity" subtitle="Recently completed or updated consultations">
                    {recentActivity.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500">
                        No recent appointment activity to display.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {recentActivity.map((appointment) => (
                          <li
                            key={appointment.appointmentId}
                            className="flex flex-wrap items-center justify-between gap-3 py-3.5 hover:bg-slate-50/50 px-2 rounded-xl transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {patientNames.get(getPatientRawId(appointment.patientId))
                                  || getPatientName(appointment.patientId)}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {new Date(appointment.appointmentDate).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant={statusVariant(appointment.status)} className="capitalize">
                              {appointment.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>

              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
