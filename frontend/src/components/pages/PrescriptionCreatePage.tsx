import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../shared/services/api';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { PatientSelect, type PatientOption } from '../molecules/PatientSelect';
import { fetchAuthorizedPatients } from '../../shared/services/patients';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { Input } from '../atoms/Input';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface Doctor {
  doctorId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  specialization?: string;
}

interface PrescriptionForm {
  patientId: string;
  doctorId: string;
  diagnosis: string;
  medicines: Medicine[];
}

const getList = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
    return response.data as T[];
  }
  return [];
};

const getPatientName = (patient: PatientOption): string =>
  patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed Patient';

const getDoctorName = (doctor: Doctor): string => {
  const name = doctor.fullName || [doctor.firstName, doctor.lastName].filter(Boolean).join(' ') || 'Doctor';
  return `Dr. ${name.replace(/^Dr\.\s*/i, '')}`;
};

const getAge = (dateOfBirth?: string): string => {
  if (!dateOfBirth || Number.isNaN(new Date(dateOfBirth).getTime())) return 'Not provided';
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) age -= 1;
  return `${age}`;
};

export const PrescriptionCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isDoctor = user?.role?.toLowerCase() === 'doctor';
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assignedPatients, setAssignedPatients] = useState<PatientOption[]>([]);
  const [assignedPatientsLoading, setAssignedPatientsLoading] = useState(isDoctor);
  const [assignedPatientsError, setAssignedPatientsError] = useState<string | null>(null);
  const [matchedDoctor, setMatchedDoctor] = useState<Doctor | null>(null);
  const [doctorLookupComplete, setDoctorLookupComplete] = useState(!isDoctor);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PrescriptionForm>({
    defaultValues: {
      patientId: searchParams.get('patientId') || '',
      doctorId: '',
      diagnosis: '',
      medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'medicines' });

  const handlePatientSelected = useCallback((patient: PatientOption | null) => {
    setSelectedPatient(patient);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchDoctors = async () => {
      if (isDoctor) {
        setAssignedPatientsLoading(true);
        setAssignedPatientsError(null);
      }
      try {
        const response = await api.get(isDoctor ? '/doctors/me' : '/doctors');
        const doctorList = isDoctor
          ? getList<Doctor>(response && typeof response === 'object' && 'data' in response
            ? [(response as { data: Doctor }).data]
            : [])
          : getList<Doctor>(response);
        if (cancelled) return;
        setDoctors(doctorList);

        if (isDoctor) {
          const ownDoctor = doctorList[0];
          if (!ownDoctor?.doctorId) throw new Error('No doctor profile is linked to your account.');
          setMatchedDoctor(ownDoctor);
          setValue('doctorId', ownDoctor.doctorId);

          // The prescription creation endpoint permits verified doctors to prescribe
          // for any existing patient. Load the real patient roster instead of
          // restricting the picker to patients with appointments.
          const doctorPatients = await fetchAuthorizedPatients();
          if (!cancelled) {
            setAssignedPatients(doctorPatients);
            const requestedPatientId = searchParams.get('patientId');
            if (requestedPatientId && !doctorPatients.some((patient) => patient.patientId === requestedPatientId)) {
              setValue('patientId', '');
            }
          }
        }
      } catch (error: unknown) {
        if (!cancelled) {
          if (isDoctor) {
            const message = error instanceof Error ? error.message : 'Could not load patients assigned to your appointments.';
            setAssignedPatients([]);
            setAssignedPatientsError(message);
          }
          toast.error(error instanceof Error ? error.message : 'Could not load doctor profiles.');
        }
      } finally {
        if (!cancelled) {
          setDoctorLookupComplete(true);
          if (isDoctor) setAssignedPatientsLoading(false);
        }
      }
    };
    void fetchDoctors();
    return () => {
      cancelled = true;
    };
  }, [isDoctor, searchParams, setValue, user?.email]);

  const submitPrescription = async (form: PrescriptionForm) => {
    if (!selectedPatient || !form.patientId || selectedPatient.patientId !== form.patientId) {
      toast.error('Please choose a patient.');
      return;
    }
    if (form.medicines.some((medicine) => !medicine.name.trim())) {
      toast.error('Enter a name for each medicine.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/prescriptions', {
        patientId: form.patientId,
        doctorId: isDoctor ? matchedDoctor?.doctorId || form.doctorId : form.doctorId,
        diagnosis: form.diagnosis,
        medicines: form.medicines,
      });
      toast.success(`Prescription saved for ${getPatientName(selectedPatient)}`);
      navigate(`/prescriptions/patient/${encodeURIComponent(form.patientId)}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save prescription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-textPrimary placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs';
  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/prescriptions"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary hover:text-primary transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Prescriptions
          </Link>
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Create New Prescription</h1>
            <p className="text-sm text-textSecondary mt-1">Issue validated medical prescriptions with precise dosage and schedule instructions.</p>
          </div>

          <form onSubmit={handleSubmit(submitPrescription)} className="space-y-6">
            <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
              <h2 className="text-base font-bold text-textPrimary mb-4 pb-3 border-b border-border">Patient & Physician Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PatientSelect
                    control={control}
                    name="patientId"
                    onPatientSelected={handlePatientSelected}
                    {...(isDoctor ? {
                      patients: assignedPatients,
                      patientsLoading: assignedPatientsLoading,
                      patientsError: assignedPatientsError,
                    } : {})}
                  />

                  {selectedPatient && (
                    <div className="rounded-xl border border-border bg-background p-3.5 text-sm">
                      <p className="font-semibold text-textPrimary">{getPatientName(selectedPatient)}</p>
                      <p className="mt-1 text-xs text-textSecondary">
                        Age: <span className="font-medium text-textPrimary">{getAge(selectedPatient.dateOfBirth)}</span> · Phone: <span className="font-medium text-textPrimary">{selectedPatient.phone || 'Not provided'}</span>
                      </p>
                    </div>
                  )}
                </div>

                {!doctorLookupComplete && (
                  <p className="text-sm text-textSecondary font-medium">Finding your doctor profile...</p>
                )}
                {doctorLookupComplete && isDoctor && matchedDoctor && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs font-semibold text-primary inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Prescribing as {getDoctorName(matchedDoctor)}
                  </div>
                )}
                {doctorLookupComplete && (!isDoctor || !matchedDoctor) && (
                  <div>
                    <Label htmlFor="doctorId" required className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">Select Doctor</Label>
                    <select
                      id="doctorId"
                      {...register('doctorId', { required: 'Please choose a doctor.' })}
                      className={fieldClass}
                    >
                      <option value="">Choose a doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.doctorId} value={doctor.doctorId}>
                          {getDoctorName(doctor)}
                          {doctor.specialization ? ` (${doctor.specialization})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.doctorId && (
                      <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{errors.doctorId.message}</p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="diagnosis" required className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">Diagnosis</Label>
                  <textarea
                    id="diagnosis"
                    rows={3}
                    {...register('diagnosis', { required: 'Diagnosis is required.' })}
                    className={fieldClass}
                    placeholder="Enter primary clinical diagnosis and presenting conditions..."
                  />
                  {errors.diagnosis && (
                    <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{errors.diagnosis.message}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
                <div>
                  <h2 className="text-base font-bold text-textPrimary">Prescribed Medications</h2>
                  <p className="text-xs text-textSecondary mt-0.5">Specify dosage, intervals, and patient instructions.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5 text-xs py-2 px-3.5"
                  onClick={() => append({ name: '', dosage: '', frequency: '', duration: '', instructions: '' })}
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  Add Medicine
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-3.5 rounded-xl border border-border bg-background p-4 sm:p-5 transition-all">
                    <div className="flex items-center justify-between border-b border-border/70 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">Medicine #{index + 1}</span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          aria-label={`Remove medicine ${index + 1}`}
                          className="rounded-lg p-1 text-textMuted hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`medicine-name-${index}`} required className="block text-xs font-semibold text-textSecondary mb-1">Name</Label>
                        <Input
                          id={`medicine-name-${index}`}
                          placeholder="e.g. Amoxicillin, Lisinopril"
                          {...register(`medicines.${index}.name`, { required: 'Medicine name is required.' })}
                          className="rounded-xl !border-border bg-surface text-textPrimary focus:!border-primary focus:!ring-primary/20 text-sm shadow-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`medicine-dosage-${index}`} required className="block text-xs font-semibold text-textSecondary mb-1">Dosage</Label>
                        <Input
                          id={`medicine-dosage-${index}`}
                          placeholder="e.g. 500mg, 10ml"
                          {...register(`medicines.${index}.dosage`, { required: 'Dosage is required.' })}
                          className="rounded-xl !border-border bg-surface text-textPrimary focus:!border-primary focus:!ring-primary/20 text-sm shadow-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`medicine-frequency-${index}`} required className="block text-xs font-semibold text-textSecondary mb-1">Frequency</Label>
                        <Input
                          id={`medicine-frequency-${index}`}
                          {...register(`medicines.${index}.frequency`, { required: 'Frequency is required.' })}
                          placeholder="e.g. Twice daily with meals"
                          className="rounded-xl !border-border bg-surface text-textPrimary focus:!border-primary focus:!ring-primary/20 text-sm shadow-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`medicine-duration-${index}`} className="block text-xs font-semibold text-textSecondary mb-1">Duration</Label>
                        <Input
                          id={`medicine-duration-${index}`}
                          placeholder="e.g. 7 days, 1 month"
                          {...register(`medicines.${index}.duration`)}
                          className="rounded-xl !border-border bg-surface text-textPrimary focus:!border-primary focus:!ring-primary/20 text-sm shadow-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`medicine-instructions-${index}`} className="block text-xs font-semibold text-textSecondary mb-1">Patient Instructions</Label>
                        <Input
                          id={`medicine-instructions-${index}`}
                          placeholder="Special precautions, take after breakfast, etc."
                          {...register(`medicines.${index}.instructions`)}
                          className="rounded-xl !border-border bg-surface text-textPrimary focus:!border-primary focus:!ring-primary/20 text-sm shadow-xs"
                        />
                      </div>
                    </div>
                    {errors.medicines?.[index]?.name && (
                      <p role="alert" className="text-xs font-medium text-danger">
                        {errors.medicines[index]?.name?.message}
                      </p>
                    )}
                    {errors.medicines?.[index]?.dosage && (
                      <p role="alert" className="text-xs font-medium text-danger">
                        {errors.medicines[index]?.dosage?.message}
                      </p>
                    )}
                    {errors.medicines?.[index]?.frequency && (
                      <p role="alert" className="text-xs font-medium text-danger">
                        {errors.medicines[index]?.frequency?.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                to="/prescriptions"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all"
              >
                Cancel
              </Link>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting || !doctorLookupComplete}
              >
                Save Prescription
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};
