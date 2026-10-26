import React, { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import api from '../../shared/services/api';
import { fetchAuthorizedPatients, type AuthorizedPatient } from '../../shared/services/patients';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface Doctor {
  doctorId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  specialization?: string;
}

const schema = z.object({
  patientId: z.string().min(1, 'Patient selection is required'),
  doctorId: z.string().min(1, 'Doctor selection is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  reason: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export const AppointmentBookPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isPatient = user?.role.toLowerCase() === 'patient';
  const [patients, setPatients] = useState<AuthorizedPatient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoadingData(true);
      setDirectoryError(null);
      const patientRequest = isPatient
        ? api.get('/patients/me', { skipToast: true }).then((response) => {
            const patient = response && typeof response === 'object' && 'data' in response
              ? response.data as AuthorizedPatient
              : null;
            if (!patient || typeof patient.patientId !== 'string') {
              throw new Error('No patient profile is linked to this account.');
            }
            return [patient];
          })
        : fetchAuthorizedPatients();
      const [patientsResult, doctorsResult] = await Promise.allSettled([
        patientRequest,
        api.get('/doctors', { skipToast: true }) as Promise<Doctor[] | { data?: Doctor[] }>,
      ]);

      if (!active) return;

      if (patientsResult.status === 'fulfilled') {
        setPatients(patientsResult.value);
        setValue('patientId', patientsResult.value[0]?.patientId || '');
      } else {
        setDirectoryError(patientsResult.reason instanceof Error
          ? patientsResult.reason.message
          : 'Failed to load authorized patients.');
      }

      if (doctorsResult.status === 'fulfilled') {
        const response = doctorsResult.value;
        const doctorList = Array.isArray(response) ? response : response.data || [];
        setDoctors(doctorList);
        setValue('doctorId', doctorList[0]?.doctorId || '');
      } else {
        const message = doctorsResult.reason instanceof Error
          ? doctorsResult.reason.message
          : 'Failed to load doctors.';
        setDirectoryError((current) => current ? `${current} ${message}` : message);
      }
      setLoadingData(false);
    };

    void fetchData();
    return () => {
      active = false;
    };
  }, [isPatient, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const appointmentDate = new Date(`${data.date}T${data.time}`);
      if (Number.isNaN(appointmentDate.getTime())) {
        throw new Error('Please enter a valid appointment date and time');
      }
      await api.post('/appointments', {
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentDate: appointmentDate.toISOString(),
        notes: data.reason,
      });
      toast.success('Appointment booked successfully!');
      navigate('/appointments');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/appointments"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary hover:text-primary transition-colors mb-6 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Appointments
          </Link>
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Book New Appointment</h1>
            <p className="text-sm text-textSecondary mt-1">Schedule a clinical consultation with an authorized physician.</p>
          </div>

          <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {directoryError && (
                <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-medium text-danger flex items-center gap-3">
                  <span>{directoryError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="apptPatient"
                    className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2"
                  >
                    Select Patient <span className="text-danger">*</span>
                  </label>
                  <select
                    id="apptPatient"
                    disabled={loadingData || patients.length === 0}
                    className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl text-textPrimary font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                    {...register('patientId')}
                  >
                    {loadingData ? (
                      <option value="">Loading patients...</option>
                    ) : patients.length === 0 ? (
                      <option value="">No patients available</option>
                    ) : (
                      patients.map((p) => {
                        const displayName =
                          p.fullName ||
                          `${p.firstName || ''} ${p.lastName || ''}`.trim() ||
                          'Unnamed Patient';
                        return (
                          <option key={p.patientId} value={p.patientId}>
                            {displayName}
                          </option>
                        );
                      })
                    )}
                  </select>
                  {errors.patientId && (
                    <p className="text-xs text-danger font-medium mt-1.5">{errors.patientId.message}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="apptDoctor"
                    className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2"
                  >
                    Select Doctor <span className="text-danger">*</span>
                  </label>
                  <select
                    id="apptDoctor"
                    disabled={loadingData || doctors.length === 0}
                    className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl text-textPrimary font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                    {...register('doctorId')}
                  >
                    {loadingData ? (
                      <option value="">Loading doctors...</option>
                    ) : doctors.length === 0 ? (
                      <option value="">No doctors available</option>
                    ) : (
                      doctors.map((d) => {
                        const docName =
                          d.fullName ||
                          `Dr. ${d.firstName || ''} ${d.lastName || ''}`.trim() ||
                          'Doctor';
                        const spec = d.specialization ? ` (${d.specialization})` : '';
                        return (
                          <option key={d.doctorId} value={d.doctorId}>
                            {docName}
                            {spec}
                          </option>
                        );
                      })
                    )}
                  </select>
                  {errors.doctorId && (
                    <p className="text-xs text-danger font-medium mt-1.5">{errors.doctorId.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  label="Appointment Date"
                  type="date"
                  required
                  error={errors.date?.message}
                  {...register('date')}
                />
                <FormField
                  label="Appointment Time"
                  type="time"
                  required
                  error={errors.time?.message}
                  {...register('time')}
                />
              </div>

              <div className="w-full">
                <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                  Reason for Visit <span className="text-textMuted font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe symptoms, routine checkup, or follow-up reason..."
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  {...register('reason')}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/appointments')}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Confirm Appointment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
