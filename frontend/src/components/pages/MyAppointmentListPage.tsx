import React, { useEffect, useRef, useState } from 'react';
import api from '../../shared/services/api';
import { parsePatientPortalList } from '../../shared/services/patientPortal';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Badge } from '../atoms/Badge';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface Appointment {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  status: string;
  notes?: string;
}

interface Patient {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

type AppointmentRole = 'patient' | 'doctor';

const statusVariant = (status: string): 'success' | 'warning' | 'danger' => {
  if (['completed', 'done'].includes(status)) return 'success';
  if (['cancelled', 'missed'].includes(status)) return 'danger';
  return 'warning';
};

const MyAppointmentList: React.FC<{ role: AppointmentRole }> = ({ role }) => {
  const user = useAuthStore((state) => state.user);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientNames, setPatientNames] = useState<Map<string, string>>(new Map());
  const [patientNamesError, setPatientNamesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchAppointments = async () => {
      setLoading(true);
      setError(null);
      setPatientNamesError(null);

      if (user?.role.toLowerCase() !== role) {
        setError('You are not authorized to view this appointment list.');
        setLoading(false);
        return;
      }

      try {
        const profilePath = role === 'patient' ? '/patients/me' : '/doctors/me';
        const profileResponse = await api.get(profilePath, { skipToast: true }) as {
          data?: { patientId?: string; doctorId?: string };
        };
        const profileId = role === 'patient'
          ? profileResponse.data?.patientId
          : profileResponse.data?.doctorId;
        if (!profileId) {
          throw new Error(`No ${role} profile is linked to your account. Please contact an administrator.`);
        }

        const response = await api.get(`/appointments/${role}/${encodeURIComponent(profileId)}`, { skipToast: true });
        if (!cancelled) {
          setAppointments(parsePatientPortalList<Appointment>(response, 'appointments'));
          if (role === 'doctor') {
            try {
              const patientsResponse = await api.get('/patients', { skipToast: true });
              if (cancelled) return;
              const patients = parsePatientPortalList<Patient>(patientsResponse, 'patients');
              setPatientNames(new Map(patients.map((patient) => [
                patient.patientId,
                patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.patientId,
              ])));
            } catch (err: unknown) {
              if (!cancelled) {
                setPatientNamesError(err instanceof Error ? err.message : 'Failed to load patient names.');
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setAppointments([]);
          setError(err instanceof Error ? err.message : 'Failed to load appointments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAppointments();
    return () => {
      cancelled = true;
    };
  }, [role, user?.role, refreshKey]);

  const cancelAppointment = async (appointmentId: string) => {
    setCancellingAppointmentId(appointmentId);
    setError(null);
    try {
      await api.put(`/appointments/${encodeURIComponent(appointmentId)}/cancel`);
      setRefreshKey((key) => key + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel appointment.');
    } finally {
      setCancellingAppointmentId(null);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  const counterpartLabel = role === 'patient' ? 'Doctor' : 'Patient';

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-textPrimary">My Appointments</h1>
          <p className="text-sm text-textSecondary mt-1">
            {role === 'patient'
              ? 'View and manage consultations booked for your patient profile.'
              : 'Consultation calendar for scheduled clinical patient appointments.'}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-primary">
            <Spinner size="lg" />
            <span className="ml-3 text-sm font-medium text-textSecondary">Loading appointments...</span>
          </div>
        )}
        {!loading && error && (
          <div role="alert" className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm font-medium mb-6">{error}</div>
        )}
        {!loading && patientNamesError && (
          <div role="status" className="mb-4 rounded-xl border border-warning/20 bg-warning/10 p-4 text-xs font-medium text-textSecondary">
            Appointment patient names could not be loaded: {patientNamesError}
          </div>
        )}
        {!loading && !error && (
          <Card className="rounded-2xl border border-border bg-surface !p-0 shadow-card hover:shadow-card-hover transition-all overflow-hidden">
            {appointments.length === 0 ? (
              <div className="p-12 text-center text-textSecondary text-sm font-medium">No appointments scheduled yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-background/80 border-b border-border text-xs uppercase font-bold tracking-wider text-textSecondary">
                    <tr>
                      <th className="px-6 py-4">{counterpartLabel}</th>
                      <th className="px-6 py-4">Date &amp; Time</th>
                      <th className="px-6 py-4">Reason / Notes</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-textPrimary">
                    {appointments.map((appointment) => (
                      <tr key={appointment.appointmentId} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-6 py-4 font-semibold text-textPrimary">
                          {role === 'patient'
                            ? appointment.doctorId
                            : patientNames.get(appointment.patientId) || appointment.patientId}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-textSecondary">
                          {new Date(appointment.appointmentDate).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs text-textSecondary max-w-xs truncate">{appointment.notes || '—'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant(appointment.status)} className="capitalize font-semibold">{appointment.status || 'scheduled'}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!['cancelled', 'completed', 'done', 'missed'].includes(appointment.status.toLowerCase()) && (
                            <button
                              type="button"
                              onClick={() => void cancelAppointment(appointment.appointmentId)}
                              disabled={cancellingAppointmentId === appointment.appointmentId}
                              className="inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {cancellingAppointmentId === appointment.appointmentId ? 'Cancelling…' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export const PatientAppointmentListPage: React.FC = () => <MyAppointmentList role="patient" />;
export const DoctorAppointmentListPage: React.FC = () => <MyAppointmentList role="doctor" />;
