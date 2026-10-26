import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../../shared/services/api';
import { fetchAuthorizedPatients } from '../../shared/services/patients';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { PatientSelect } from '../molecules/PatientSelect';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface Patient {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

interface Doctor {
  doctorId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  specialization?: string;
}

interface MedicalRecordForm {
  patientId: string;
}

export const MedicalRecordCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDoctor = useAuthStore((state) => state.user?.role.toLowerCase() === 'doctor');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { control, setValue } = useForm<MedicalRecordForm>({ defaultValues: { patientId: '' } });
  const patientId = useWatch({ control, name: 'patientId' }) || '';
  const [doctorId, setDoctorId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [allergies, setAllergies] = useState('');

  useEffect(() => {
    let active = true;
    const fetchDirectory = async () => {
      setLoadingDirectory(true);
      setDirectoryError(null);
      const [patientsResult, doctorsResult] = await Promise.allSettled([
        fetchAuthorizedPatients(),
        isDoctor
          ? Promise.resolve(null)
          : api.get('/doctors') as Promise<Doctor[] | { data?: Doctor | Doctor[] }>,
      ]);

      if (!active) return;

      if (patientsResult.status === 'fulfilled') {
        const patientList = patientsResult.value;
        setPatients(patientList);
        const requestedPatientId = searchParams.get('patientId') || '';
        const selectedPatient = patientList.find((patient) => patient.patientId === requestedPatientId);
        setValue('patientId', selectedPatient?.patientId || patientList[0]?.patientId || '');
      } else {
        const message = patientsResult.reason instanceof Error
          ? patientsResult.reason.message
          : 'Failed to load authorized patients.';
        setDirectoryError(message);
      }

      if (doctorsResult.status === 'fulfilled' && !isDoctor && doctorsResult.value) {
        const response = doctorsResult.value;
        let doctorList: Doctor[] = [];
        if (Array.isArray(response)) {
          doctorList = response;
        } else if (Array.isArray(response.data)) {
          doctorList = response.data;
        }
        setDoctors(doctorList);
        setDoctorId(doctorList[0]?.doctorId || '');
      } else if (doctorsResult.status === 'rejected') {
        const message = doctorsResult.reason instanceof Error
          ? doctorsResult.reason.message
          : 'Failed to load doctor information.';
        setDirectoryError((current) => current ? `${current} ${message}` : message);
      }
      setLoadingDirectory(false);
    };

    void fetchDirectory();
    return () => {
      active = false;
    };
  }, [isDoctor, searchParams, setValue]);

  const fieldClass =
    'w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 shadow-xs';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || (!isDoctor && !doctorId) || !diagnosis.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const allergiesArray = allergies
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      await api.post('/medical-records', {
        patientId,
        ...(!isDoctor ? { doctorId } : {}),
        diagnosis,
        notes,
        allergies: allergiesArray,
      });
      toast.success('Medical record created!');
      navigate(`/medical-records?patientId=${encodeURIComponent(patientId)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create medical record');
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
            to="/medical-records"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary hover:text-primary transition-colors mb-6 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Medical Records
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Create Medical Record</h1>
            <p className="text-sm text-textSecondary mt-1">Record official clinical diagnosis, known allergies, and treatment documentation.</p>
          </div>

          <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
            <form onSubmit={handleSubmit} className="space-y-6">
              {directoryError && (
                <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-medium text-danger">
                  {directoryError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                    Patient <span className="text-danger">*</span>
                  </label>
                  <PatientSelect
                    control={control}
                    name="patientId"
                    patients={patients}
                    patientsLoading={loadingDirectory}
                    patientsError={directoryError}
                  />
                </div>
                {!isDoctor && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                      Select Doctor <span className="text-danger">*</span>
                    </label>
                    <select
                      className={fieldClass}
                      value={doctorId}
                      onChange={(e) => setDoctorId(e.target.value)}
                      disabled={loadingDirectory || doctors.length === 0 || isDoctor}
                      required
                    >
                      {loadingDirectory ? (
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
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                  Primary Diagnosis <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  className={fieldClass}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Enter primary clinical diagnosis..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                  Clinical Examination & Treatment Notes
                </label>
                <textarea
                  rows={4}
                  className={fieldClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detailed observations, treatment regimen, clinical follow-up..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                  Known Allergies <span className="text-textMuted lowercase font-normal">(comma-separated)</span>
                </label>
                <input
                  className={fieldClass}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Aspirin, Latex"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/medical-records')}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Save Medical Record
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
