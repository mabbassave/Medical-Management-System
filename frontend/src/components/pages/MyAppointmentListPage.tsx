import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../shared/services/api';
import { parsePatientPortalList } from '../../shared/services/patientPortal';
import { useAuthStore } from '../../store/authStore';
import { socket } from '../../shared/services/socket';
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
  email?: string;
  phone?: string;
}

interface Doctor {
  doctorId: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  specialization?: string;
}

type AppointmentRole = 'patient' | 'doctor';

const statusVariant = (status: string): 'success' | 'warning' | 'danger' => {
  const normalized = status.toLowerCase();
  if (['completed', 'done'].includes(normalized)) return 'success';
  if (['cancelled', 'canceled', 'missed'].includes(normalized)) return 'danger';
  return 'warning';
};

const MyAppointmentList: React.FC<{ role: AppointmentRole }> = ({ role }) => {
  const user = useAuthStore((state) => state.user);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientNames, setPatientNames] = useState<Map<string, string>>(new Map());
  const [patientNamesError, setPatientNamesError] = useState<string | null>(null);
  const [doctorsById, setDoctorsById] = useState<Map<string, Doctor>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [completingAppointmentId, setCompletingAppointmentId] = useState<string | null>(null);
  const [reschedulingAppointmentId, setReschedulingAppointmentId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAppointments = async () => {
      if (!hasLoaded.current) setLoading(true);
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
        const profileData = profileResponse?.data || profileResponse as unknown as { patientId?: string; doctorId?: string };
        const profileId = role === 'patient' ? profileData.patientId : profileData.doctorId;
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
          } else {
            try {
              const doctorResponse = await api.get('/doctors', { skipToast: true });
              const doctorList = parsePatientPortalList<Doctor>(doctorResponse, 'doctors');
              if (!cancelled) setDoctorsById(new Map(doctorList.map((doctor) => [doctor.doctorId, doctor])));
            } catch {
              if (!cancelled) setDoctorsById(new Map());
            }
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setAppointments([]);
          setError(err instanceof Error ? err.message : 'Failed to load appointments');
        }
      } finally {
        if (!cancelled) {
          hasLoaded.current = true;
          setLoading(false);
        }
      }
    };

    void fetchAppointments();
    return () => {
      cancelled = true;
    };
  }, [role, user?.role, refreshKey]);

  useEffect(() => {
    if (!user || user.role.toLowerCase() !== role) return;
    const interval = window.setInterval(() => setRefreshKey((key) => key + 1), 10000);
    const handleAppointmentUpdate = () => setRefreshKey((key) => key + 1);
    socket.on('appointment-updated', handleAppointmentUpdate);
    return () => {
      window.clearInterval(interval);
      socket.off('appointment-updated', handleAppointmentUpdate);
    };
  }, [role, user]);

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

  const completeAppointment = async (appointmentId: string) => {
    setCompletingAppointmentId(appointmentId);
    setError(null);
    try {
      await api.put(`/appointments/${encodeURIComponent(appointmentId)}/complete`);
      setRefreshKey((key) => key + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete appointment.');
    } finally {
      setCompletingAppointmentId(null);
    }
  };

  const rescheduleAppointment = async (event: React.FormEvent, appointmentId: string) => {
    event.preventDefault();
    const date = new Date(`${rescheduleDate}T${rescheduleTime}`);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      setError('Choose a valid future appointment time.');
      return;
    }
    try {
      await api.put(`/appointments/${encodeURIComponent(appointmentId)}/reschedule`, { appointmentDate: date.toISOString() });
      setReschedulingAppointmentId(null);
      setRefreshKey((key) => key + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule appointment.');
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
          <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-textSecondary mt-1">
            {role === 'patient'
              ? 'View and manage consultations booked for your patient profile.'
              : 'Consultation calendar for scheduled clinical patient appointments.'}
          </p>
          {role === 'patient' && <Link to="/appointments/book" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover">Book Appointment</Link>}
          </div>
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
              <div className="p-12 text-center text-textSecondary text-sm font-medium">{role === 'patient' ? <><p>No appointments scheduled yet.</p><Link to="/appointments/book" className="mt-4 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">Book an appointment</Link></> : 'No appointments scheduled yet.'}</div>
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
                            ? <><p>{doctorsById.get(appointment.doctorId)?.fullName || [doctorsById.get(appointment.doctorId)?.firstName, doctorsById.get(appointment.doctorId)?.lastName].filter(Boolean).join(' ') || appointment.doctorId}</p><p className="mt-1 text-xs font-normal text-textSecondary">{doctorsById.get(appointment.doctorId)?.specialization || 'Specialty not listed'}</p><p className="mt-1 text-[10px] font-normal text-textMuted">Confirmation: {appointment.appointmentId}</p></>
                            : <><p>{patientNames.get(appointment.patientId) || appointment.patientId}</p><Link to={`/patients/${encodeURIComponent(appointment.patientId)}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">View patient details</Link><p className="mt-1 text-[10px] font-normal text-textMuted">Confirmation: {appointment.appointmentId}</p></>}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-textSecondary">
                          {new Date(appointment.appointmentDate).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs text-textSecondary max-w-xs truncate">{appointment.notes || '—'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant(appointment.status)} className="capitalize font-semibold">{appointment.status || 'scheduled'}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!['cancelled', 'canceled', 'completed', 'done', 'missed'].includes(appointment.status.toLowerCase()) && (
                            <button
                              type="button"
                              onClick={() => void cancelAppointment(appointment.appointmentId)}
                              disabled={cancellingAppointmentId === appointment.appointmentId}
                              className="inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {cancellingAppointmentId === appointment.appointmentId ? 'Cancelling…' : 'Cancel'}
                            </button>
                          )}
                          {role === 'doctor' && ['scheduled', 'pending'].includes(appointment.status.toLowerCase()) && (
                            <button type="button" disabled={completingAppointmentId === appointment.appointmentId} onClick={() => void completeAppointment(appointment.appointmentId)} className="ml-2 inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-all disabled:opacity-60">{completingAppointmentId === appointment.appointmentId ? 'Saving…' : 'Complete'}</button>
                          )}
                          {['scheduled', 'pending'].includes(appointment.status.toLowerCase()) && (
                            <button type="button" onClick={() => {
                              const date = new Date(appointment.appointmentDate);
                              setRescheduleDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
                              setRescheduleTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
                              setReschedulingAppointmentId(appointment.appointmentId);
                            }} className="ml-2 inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-all">Reschedule</button>
                          )}
                          {reschedulingAppointmentId === appointment.appointmentId && (
                            <form className="mt-3 flex flex-wrap items-center justify-end gap-2" onSubmit={(event) => void rescheduleAppointment(event, appointment.appointmentId)}>
                              <input aria-label="New appointment date" required type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="rounded-lg border border-border px-2 py-1 text-xs" />
                              <input aria-label="New appointment time" required type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} className="rounded-lg border border-border px-2 py-1 text-xs" />
                              <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">Save</button>
                              <button type="button" onClick={() => setReschedulingAppointmentId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Close</button>
                            </form>
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
