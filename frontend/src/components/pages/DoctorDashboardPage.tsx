import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle,
} from 'lucide-react';
import api from '../../shared/services/api';
import { fetchAuthorizedPatients } from '../../shared/services/patients';
import { parsePatientPortalList } from '../../shared/services/patientPortal';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
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

interface VitalRecord {
  patientId: string;
  status?: string;
  heartRate?: number;
  bloodPressure?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  analysis?: {
    status?: string;
    message?: string;
  };
}

interface CriticalAlert {
  patientId: string;
  patientName: string;
  detail: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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


// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  valueCls?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, iconBg, valueCls }) => (
  <Card className="border-border hover:border-primary/40 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`numeric text-3xl font-extrabold tracking-tight mt-1.5 ${valueCls ?? 'text-slate-900'}`}>{value}</p>
      </div>
      <div className={`p-3 rounded-2xl ${iconBg} shadow-xs`}>{icon}</div>
    </div>
  </Card>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  // Step 2 — once appointments load, scan vitals for critical readings
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

    const fetchCriticalAlerts = async () => {
      setAlertsLoading(true);
      setAlertsError(null);
      const results = await Promise.allSettled(
        uniquePatientIds.map(async (pid): Promise<CriticalAlert | null> => {
          const res: any = await api.get(`/vitals/patient/${encodeURIComponent(pid)}`, { skipToast: true });
          const vitals: VitalRecord[] = Array.isArray(res) ? res : res.data ?? [];
          const latest = vitals[0];
          const latestStatus = latest?.analysis?.status || latest?.status;
          if (!latest || latestStatus !== 'critical') return null;

          const matchingAppt = allAppointments.find(
            (appointment) => getPatientRawId(appointment.patientId) === pid
          );
          const name = patientNames.get(pid)
            || (matchingAppt ? getPatientName(matchingAppt.patientId, pid) : pid);
          const bloodPressure = latest.bloodPressure
            || (latest.bloodPressureSystolic != null && latest.bloodPressureDiastolic != null
              ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`
              : '');
          const detail = bloodPressure
            ? `BP: ${bloodPressure}${latest.heartRate ? `, HR: ${latest.heartRate} bpm` : ''}`
            : latest.heartRate
              ? `HR: ${latest.heartRate} bpm`
              : latest.analysis?.message || 'Critical readings recorded';
          return { patientId: pid, patientName: name, detail };
        })
      );
      if (cancelled) return;
      setCriticalAlerts(results.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : []
      ));
      const failedChecks = results.filter((result) => result.status === 'rejected').length;
      if (failedChecks > 0) {
        setAlertsError(`Could not load vitals for ${failedChecks} assigned patient${failedChecks === 1 ? '' : 's'}.`);
      }
      setAlertsLoading(false);
    };

    void fetchCriticalAlerts();
    return () => {
      cancelled = true;
    };
  }, [allAppointments, patientNames]);

  // ─── Derived values ─────────────────────────────────────────────────────────
  const todaysAppointments = allAppointments.filter((a) => isToday(a.appointmentDate));
  const recentActivity = allAppointments
    .filter((appointment) => ['completed', 'cancelled', 'missed'].includes(appointment.status.toLowerCase()))
    .sort((first, second) => new Date(second.appointmentDate).getTime() - new Date(first.appointmentDate).getTime())
    .slice(0, 5);

  const uniquePatientCount = new Set(
    allAppointments.map((appointment) => getPatientRawId(appointment.patientId))
  ).size;
  const appointmentStatusData = Array.from(
    allAppointments.reduce((counts, appointment) => {
      const status = appointment.status.trim() || 'Unspecified';
      counts.set(status, (counts.get(status) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  )
    .map(([status, count]) => ({
      status,
      count,
      percentage: allAppointments.length > 0
        ? Math.round((count / allAppointments.length) * 100)
        : 0,
    }))
    .sort((first, second) => second.count - first.count);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div ref={containerRef}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-textPrimary">
            Good morning, Dr. {user?.name || user?.username || 'Doctor'} 👋
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Your clinical summary for{' '}
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-primary">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-textSecondary">Loading your dashboard…</span>
          </div>
        )}

        {!loading && (
          <>
            {appointmentsError && (
              <div className="mb-6 rounded-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
                {appointmentsError}
              </div>
            )}
            {patientsError && (
              <div className="mb-6 rounded-md border border-warning/20 bg-warning/10 p-4 text-sm text-textSecondary">
                Patient names could not be loaded: {patientsError}
              </div>
            )}
            {appointmentsError ? null : (
            <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-3">
              <StatCard
                label="Today's Appointments"
                value={todaysAppointments.length}
                icon={<Calendar className="w-5 h-5" />}
                iconBg="bg-blue-50 text-blue-600 border border-blue-100"
              />
              <StatCard
                label="Total Patients"
                value={uniquePatientCount}
                icon={<Users className="w-5 h-5" />}
                iconBg="bg-teal-50 text-teal-600 border border-teal-100"
              />
              <StatCard
                label="Critical Alerts"
                value={criticalAlerts.length}
                icon={<AlertTriangle className="w-5 h-5" />}
                iconBg={
                  criticalAlerts.length > 0
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : 'bg-slate-50 text-slate-500 border border-slate-100'
                }
                valueCls={criticalAlerts.length > 0 ? 'text-rose-600' : 'text-slate-900'}
              />
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Today's Schedule (2/3 wide) */}
              <div className="lg:col-span-2">
                <Card
                  title="Today's Schedule"
                  subtitle={`${todaysAppointments.length} appointment${todaysAppointments.length !== 1 ? 's' : ''} today`}
                  className="shadow-md"
                >
                  {todaysAppointments.length === 0 ? (
                    <div className="text-center py-10">
                      <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                      <p className="text-sm text-textSecondary">
                        No appointments scheduled for today.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {todaysAppointments.map((appt) => (
                        <li
                          key={appt.appointmentId}
                          className="py-3 flex items-center justify-between gap-4"
                        >
                          {/* Time */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Clock className="w-4 h-4 text-textSecondary" />
                            <span className="text-sm font-medium text-textPrimary w-12">
                              {new Date(appt.appointmentDate).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Patient + reason */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-textPrimary truncate">
                              {patientNames.get(getPatientRawId(appt.patientId)) || getPatientName(appt.patientId)}
                            </p>
                            {appt.notes && (
                              <p className="text-xs text-textSecondary truncate">{appt.notes}</p>
                            )}
                          </div>

                          {/* Status */}
                          <Badge
                            variant={statusVariant(appt.status)}
                            className="shrink-0 capitalize"
                          >
                            {appt.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {/* Right column: Alerts + Quick Actions */}
              <div className="flex flex-col gap-6">

                {/* Critical Alerts */}
                <Card
                  title="Critical Alerts"
                  subtitle="Patients with critical vitals"
                  className={`shadow-md transition-shadow hover:shadow-lg ${criticalAlerts.length > 0 ? 'border-danger/40' : ''}`}
                >
                  {alertsLoading ? (
                    <div className="flex items-center gap-2 py-4 text-textSecondary text-sm">
                      <Spinner size="sm" />
                      Checking vitals…
                    </div>
                  ) : alertsError ? (
                    <div role="status" className="rounded-md border border-warning/20 bg-warning/10 p-3 text-xs text-textSecondary">
                      {alertsError}
                    </div>
                  ) : criticalAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-7 h-7 text-success mx-auto mb-2" />
                      <p className="text-sm text-textSecondary">All patients look stable.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {criticalAlerts.map((alert) => (
                        <li
                          key={alert.patientId}
                          className="flex items-start gap-3 rounded-md border border-danger/20 bg-danger/10 p-3"
                        >
                          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-danger truncate">
                              {alert.patientName}
                            </p>
                            <p className="text-xs text-danger mt-0.5">{alert.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card
                  title="Appointment overview"
                  subtitle="Status distribution from your appointments"
                >
                  {appointmentStatusData.length === 0 ? (
                    <p className="py-4 text-center text-sm text-textSecondary">
                      No appointment data available to chart.
                    </p>
                  ) : (
                    <div
                      className="doctor-dashboard-chart"
                      role="group"
                      aria-label="Appointment status distribution"
                    >
                      {appointmentStatusData.map(({ status, count, percentage }) => (
                        <div key={status} className="doctor-dashboard-chart-row">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-xs font-medium capitalize text-textPrimary">{status}</span>
                            <span className="shrink-0 text-xs text-textSecondary">
                              {count} <span className="text-textMuted">·</span> {percentage}%
                            </span>
                          </div>
                          <div
                            className="doctor-dashboard-chart-track"
                            role="progressbar"
                            aria-label={`${status} appointments`}
                            aria-valuemin={0}
                            aria-valuemax={allAppointments.length}
                            aria-valuenow={count}
                          >
                            <span
                              className={`doctor-dashboard-chart-fill ${statusVariant(status)}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Quick Actions */}
                <Card title="Quick Actions">
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-50 to-emerald-50 p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-teal-950">AI Vitals Facial Scan</p>
                        <p className="text-[11px] text-teal-800">Contactless vital signs assessment</p>
                      </div>
                      <Link to="/vitals" className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors">
                        Scan now
                      </Link>
                    </div>
                    <Link to="/prescriptions/new">
                      <Button variant="primary" className="w-full">
                        <FileText className="w-4 h-4 mr-2" />
                        Write Prescription
                      </Button>
                    </Link>
                    <Link to="/patients">
                      <Button variant="secondary" className="w-full">
                        <Users className="w-4 h-4 mr-2" />
                        View My Patients
                      </Button>
                    </Link>
                  </div>
                </Card>

              </div>
            </div>

            <div className="mt-6">
              <Card title="Recent Activity" subtitle="Recently completed or cancelled appointments">
                {recentActivity.length === 0 ? (
                  <p className="py-4 text-center text-sm text-textSecondary">
                    No recent appointment activity.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {recentActivity.map((appointment) => (
                      <li
                        key={appointment.appointmentId}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-textPrimary">
                            {patientNames.get(getPatientRawId(appointment.patientId))
                              || getPatientName(appointment.patientId)}
                          </p>
                          <p className="text-xs text-textSecondary">
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
