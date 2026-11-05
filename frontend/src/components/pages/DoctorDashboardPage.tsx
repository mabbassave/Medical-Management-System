import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarDays,
  CircleDot,
  Users,
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle,
  Activity,
  ArrowUpRight,
  XCircle,
  Stethoscope,
} from 'lucide-react';
import api from '../../shared/services/api';
import { fetchAuthorizedPatients, type AuthorizedPatient } from '../../shared/services/patients';
import { parsePatientPortalList } from '../../shared/services/patientPortal';
import { socket } from '../../shared/services/socket';
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
  doctorId: string;
  appointmentDate: string;
  notes?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  activityHistory?: Array<{
    event: 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'RESCHEDULED';
    actorRole: 'patient' | 'doctor' | 'admin' | 'nurse';
    appointmentDate: string;
    occurredAt: string;
  }>;
}

interface AppointmentActivity {
  appointment: Appointment;
  occurredAt: string;
  appointmentDate: string;
  description: string;
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
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

const normalizeAppointmentStatus = (status?: string): 'scheduled' | 'completed' | 'cancelled' | null => {
  const normalized = (status || '').trim().toLowerCase();
  if (['scheduled', 'booked', 'pending', 'confirmed'].includes(normalized)) return 'scheduled';
  if (['completed', 'complete', 'done'].includes(normalized)) return 'completed';
  if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled';
  return null;
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
  const [assignedPatientsList, setAssignedPatientsList] = useState<AuthorizedPatient[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [refreshConnected, setRefreshConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  const isFetchingRef = useRef(false);

  // Live data fetcher for Doctor Dashboard
  const fetchDashboardData = useCallback(async (isInitial = false) => {
    if (!user) return;
    if (user.role.toLowerCase() !== 'doctor') {
      setAppointmentsError('You are not authorized to view this dashboard.');
      if (isInitial) setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setRefreshing(true);

    if (isInitial) {
      setLoading(true);
      setAppointmentsError(null);
    }

    try {
      // 1. Get logged-in doctor profile with fallback to stored profile
      let doctorId = (user as any)?.doctorId || (user as any)?.linkedId;
      try {
        const profileResponse = (await api.get('/doctors/me', { skipToast: true })) as {
          data?: { doctorId?: string };
        };
        if (profileResponse?.data?.doctorId) {
          doctorId = profileResponse.data.doctorId;
        }
      } catch {
        // Fall back to stored doctorId if available
      }

      if (!doctorId) {
        throw new Error('No doctor profile is linked to your account. Please contact an administrator.');
      }

      // 2. Fetch appointments, assigned patients, and patient directory in parallel
      const [appointmentsRes, assignedPatientsRes, allPatientsRes] = await Promise.allSettled([
        api.get(`/appointments/doctor/${encodeURIComponent(doctorId)}`, { skipToast: true }),
        api.get('/patients/assigned', { skipToast: true }),
        fetchAuthorizedPatients(),
      ]);

      let appointmentsList: Appointment[] = [];
      if (appointmentsRes.status === 'fulfilled') {
        appointmentsList = parsePatientPortalList<Appointment>(appointmentsRes.value, 'appointments')
          .filter((appointment) => appointment.doctorId === doctorId);
        setAllAppointments(appointmentsList);
        setAppointmentsError(null);
        setAppointmentsLoaded(true);
        setLastRefreshAt(new Date());
        setRefreshConnected(true);
      } else {
        const err = appointmentsRes.reason;
        setAppointmentsError(err instanceof Error ? err.message : 'Failed to load appointments');
      }
      if (appointmentsRes.status === 'rejected') setRefreshConnected(false);

      let assignedList: AuthorizedPatient[] = [];
      if (assignedPatientsRes.status === 'fulfilled') {
        const resVal = assignedPatientsRes.value as { data?: AuthorizedPatient[] } | AuthorizedPatient[];
        assignedList = Array.isArray(resVal)
          ? resVal
          : (resVal as { data?: AuthorizedPatient[] })?.data || [];
        setAssignedPatientsList(assignedList);
      }

      const namesMap = new Map<string, string>();
      if (allPatientsRes.status === 'fulfilled') {
        allPatientsRes.value.forEach((p) => {
          const name = p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.patientId;
          namesMap.set(p.patientId, name);
        });
        setPatientNames(namesMap);
        setPatientsError(null);
      }

      // Map any assigned patient names if not in allPatients
      assignedList.forEach((p) => {
        if (!namesMap.has(p.patientId)) {
          const name = p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.patientId;
          namesMap.set(p.patientId, name);
        }
      });

      // 3. Scan vitals of all assigned patients for active critical alerts
      const uniquePatientIds = Array.from(
        new Set([
          ...assignedList.map((p) => p.patientId),
          ...appointmentsList.map((a) => getPatientRawId(a.patientId)),
        ])
      ).filter(Boolean);

      if (uniquePatientIds.length === 0) {
        setCriticalAlerts([]);
        setAlertsError(null);
      } else {
        if (isInitial) setAlertsLoading(true);
        try {
          const alertPromises = uniquePatientIds.map(async (rawId) => {
            try {
              const res = await api.get(`/vitals/patient/${encodeURIComponent(rawId)}`, {
                skipToast: true,
              });
              const records = (
                Array.isArray(res) ? res : (res as { data?: unknown[] }).data || []
              ) as Array<{
                heartRate?: number;
                bloodPressureSystolic?: number;
                bloodPressureDiastolic?: number;
                sugarLevel?: number;
                temperature?: number;
                status?: string;
                analysis?: { status?: string; message?: string };
              }>;

              if (records.length === 0) return null;
              const latest = records[0];
              const isCritical =
                latest.status?.toLowerCase() === 'critical' ||
                latest.analysis?.status?.toLowerCase() === 'critical' ||
                (latest.heartRate != null && (latest.heartRate > 120 || latest.heartRate < 45)) ||
                (latest.bloodPressureSystolic != null && latest.bloodPressureSystolic > 180) ||
                (latest.bloodPressureDiastolic != null && latest.bloodPressureDiastolic > 120) ||
                (latest.sugarLevel != null && (latest.sugarLevel > 200 || latest.sugarLevel < 70)) ||
                (latest.temperature != null && (latest.temperature > 39.5 || latest.temperature < 35.0));

              if (!isCritical) return null;

              return {
                patientId: rawId,
                patientName: namesMap.get(rawId) || rawId,
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
          setCriticalAlerts(results.filter((a): a is CriticalAlert => a !== null));
          setAlertsError(null);
        } catch (err: unknown) {
          setAlertsError(err instanceof Error ? err.message : 'Failed to check patient vitals.');
        } finally {
          if (isInitial) setAlertsLoading(false);
        }
      }
    } catch (error: unknown) {
      setAppointmentsError(error instanceof Error ? error.message : 'Failed to load dashboard data');
      setRefreshConnected(false);
    } finally {
      isFetchingRef.current = false;
      setRefreshing(false);
      if (isInitial) setLoading(false);
    }
  }, [user]);

  // Initial load & Real-time automatic updates
  useEffect(() => {
    void fetchDashboardData(true);

    // Socket.io real-time subscriptions
    const doctorUserId = user?.id || (user as { _id?: string })?._id;
    if (doctorUserId) {
      socket.emit('join', doctorUserId);
      socket.emit('join-room', doctorUserId);
    }
    socket.emit('join-role', 'doctor');
    socket.emit('join-room', 'doctor');

    const handleRealtimeUpdate = () => {
      void fetchDashboardData(false);
    };

    socket.on('critical-vitals', handleRealtimeUpdate);
    socket.on('notification', handleRealtimeUpdate);
    socket.on('appointment-updated', handleRealtimeUpdate);

    // Live background polling (every 5 seconds) to catch appointment changes, assignments, cancellations
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchDashboardData(false);
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchDashboardData(false);
      }
    };
    const handleFocus = () => {
      void fetchDashboardData(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      socket.off('critical-vitals', handleRealtimeUpdate);
      socket.off('notification', handleRealtimeUpdate);
      socket.off('appointment-updated', handleRealtimeUpdate);
    };
  }, [fetchDashboardData, user?.id]);

  // Fetch doctors for Clinical Care Team
  useEffect(() => {
    let cancelled = false;
    const fetchDoctors = async () => {
      try {
        const res = (await api.get('/doctors', { skipToast: true })) as { data?: Doctor[] } | Doctor[];
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

  // ── Metric 1: Today's Appointments ──
  // Show the actual total number of appointments scheduled for today (excluding cancelled)
  const todaysAppointments = useMemo(() => {
    return allAppointments.filter((a) => {
      if (!a.appointmentDate || !isToday(a.appointmentDate)) return false;
      return normalizeAppointmentStatus(a.status) !== 'cancelled';
    }).sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());
  }, [allAppointments]);
  const hasScheduledToday = todaysAppointments.some(
    (appointment) => normalizeAppointmentStatus(appointment.status) === 'scheduled'
  );

  // ── Metric 2: Assigned Patients ──
  // Show the actual total number of patients assigned to the currently logged-in doctor
  const uniquePatientCount = useMemo(() => {
    const ids = new Set<string>();
    assignedPatientsList.forEach((p) => {
      if (p.patientId) ids.add(p.patientId);
    });
    allAppointments.forEach((a) => {
      const rawId = getPatientRawId(a.patientId);
      if (rawId) ids.add(rawId);
    });
    return ids.size;
  }, [assignedPatientsList, allAppointments]);

  const appointmentStatusData = React.useMemo(() => {
    const supportedStatuses = ['scheduled', 'completed', 'cancelled'];
    const counts = allAppointments.reduce<Record<string, number>>((acc, appointment) => {
      const status = normalizeAppointmentStatus(appointment.status);
      if (status) acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const total = allAppointments.length;
    return supportedStatuses.map((status) => ({
      status,
      count: counts[status] || 0,
      percentage: total ? Math.round(((counts[status] || 0) / total) * 100) : 0,
    }));
  }, [allAppointments]);

  const recentActivity: AppointmentActivity[] = allAppointments
    .flatMap((appointment) => (appointment.activityHistory || []).map((event) => ({
      appointment,
      occurredAt: event.occurredAt,
      appointmentDate: event.appointmentDate,
      description: event.event === 'BOOKED'
        ? `New appointment booked by ${event.actorRole}`
        : event.event === 'CANCELLED'
          ? `Appointment cancelled by ${event.actorRole}`
          : event.event === 'COMPLETED'
            ? `Consultation completed by ${event.actorRole}`
            : `Appointment rescheduled by ${event.actorRole}`,
    })))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
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
                <div className="doctor-dashboard-sections grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Left Column: Today's Schedule (2 cols wide) */}
                  <div className="doctor-dashboard-schedule lg:col-span-2">
                    <Card
                      title="Today's Schedule"
                      subtitle={`${todaysAppointments.length} appointment${todaysAppointments.length !== 1 ? 's' : ''} scheduled for today`}
                      action={<span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700"><CalendarDays className="h-5 w-5" /></span>}
                    >
                      <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{todaysAppointments.length}<span className="ml-2 text-sm font-medium text-slate-500">appointments</span></p></div>
                        <span className={`inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold ${hasScheduledToday ? 'border-emerald-100 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${hasScheduledToday ? 'bg-emerald-500' : 'bg-slate-300'}`} />{!appointmentsLoaded ? 'Checking schedule' : hasScheduledToday ? 'On schedule' : todaysAppointments.length > 0 ? 'No upcoming visits' : 'No appointments'}</span>
                      </div>
                      {todaysAppointments.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
                          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-600 shadow-sm"><Calendar className="h-6 w-6" /></span>
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
                              className="group p-3.5 flex items-center justify-between gap-4 bg-white hover:bg-slate-50/80 border border-slate-100 rounded-2xl transition-all duration-200 hover:border-slate-200 hover:shadow-sm"
                            >
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="h-9 w-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs">
                                  <Clock className="w-4 h-4 text-emerald-600" />
                                </div>
                                <span className="flex w-20 flex-col">
                                  <span className="text-sm font-bold text-slate-900">{new Date(appt.appointmentDate).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}</span>
                                  <span className="mt-0.5 text-[10px] font-medium text-slate-500">{new Date(appt.appointmentDate).toLocaleDateString()}</span>
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
                  <div className="doctor-dashboard-side flex flex-col gap-6">

                    {/* Critical Alerts Card */}
                    <Card
                      title="Critical Alerts"
                      subtitle="Patients requiring immediate follow-up"
                      action={<span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>}
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
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 py-7 text-center">
                          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-800">All patients look stable.</p>
                          <p className="text-xs text-slate-500 mt-0.5">No critical deviations detected.</p>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {criticalAlerts.map((alert) => (
                            <li
                              key={alert.patientId}
                              className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/75 p-4 transition-colors hover:bg-rose-50"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm"><AlertTriangle className="h-4 w-4" /></span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2"><p className="truncate text-sm font-bold text-slate-900">{alert.patientName}</p><span className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">Critical</span></div>
                                <p className="mt-1.5 text-xs leading-5 text-rose-800">{alert.detail}</p>
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
                      {allAppointments.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                          No appointment data recorded yet.
                        </p>
                      ) : (
                        <div className="space-y-5 pt-1">
                          {appointmentStatusData.map(({ status, count, percentage }) => (
                            <div key={status} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold capitalize text-slate-800">{status}</span>
                                <span className="font-semibold tabular-nums text-slate-500">{count} <span className="text-slate-400">· {percentage}%</span></span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ease-out ${status === 'scheduled' ? 'bg-emerald-500' : status === 'completed' ? 'bg-sky-500' : 'bg-rose-300'}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                  </div>

                {/* ── RECENT ACTIVITY TABLE ── */}
                <div className="doctor-dashboard-activity mt-2 lg:col-span-2">
                  <Card title="Recent Activity" subtitle="Recently completed or updated consultations" action={<span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide ${refreshing || refreshConnected ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${refreshConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />{refreshing ? 'UPDATING' : refreshConnected ? 'LIVE' : 'OFFLINE'}</span>}>
                    <div className="mb-3 flex items-center gap-2 text-xs text-slate-500" role="status" aria-live="polite">
                      {refreshing ? 'Updating appointment data…' : refreshConnected ? `Last successful refresh ${lastRefreshAt?.toLocaleTimeString() || 'just now'}` : 'Offline · appointment data unavailable'}
                    </div>
                    {recentActivity.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-9 text-center"><span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm"><Activity className="h-5 w-5" /></span><p className="text-sm font-semibold text-slate-700">No recent appointment activity to display.</p></div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {recentActivity.map(({ appointment, occurredAt, appointmentDate, description }) => (
                          <li
                            key={appointment.appointmentId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-slate-50/70"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${normalizeAppointmentStatus(appointment.status) === 'completed' ? 'bg-sky-50 text-sky-600' : normalizeAppointmentStatus(appointment.status) === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{normalizeAppointmentStatus(appointment.status) === 'completed' ? <Stethoscope className="h-4 w-4" /> : normalizeAppointmentStatus(appointment.status) === 'cancelled' ? <XCircle className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}</span>
                              <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {patientNames.get(getPatientRawId(appointment.patientId))
                                  || getPatientName(appointment.patientId)}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-slate-600">{description}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Appointment: {new Date(appointmentDate).toLocaleString()}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Event time: {new Date(occurredAt).toLocaleString()}</p>
                              </div>
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
                </div>

              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
