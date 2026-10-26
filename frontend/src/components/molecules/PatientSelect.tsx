import React, { useEffect, useId, useState } from 'react';
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { fetchAuthorizedPatients } from '../../shared/services/patients';
import { Label } from '../atoms/Label';

export interface PatientOption {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  dateOfBirth?: string;
  phone?: string;
}

interface PatientSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  onPatientSelected?: (patient: PatientOption | null) => void;
  patients?: PatientOption[];
  patientsLoading?: boolean;
  patientsError?: string | null;
}

interface PatientSelectInputProps<T extends FieldValues> {
  field: ControllerRenderProps<T, Path<T>>;
  fieldState: ControllerFieldState;
  patients: PatientOption[];
  loading: boolean;
  error: string | null;
  onPatientSelected?: (patient: PatientOption | null) => void;
}

const getPatientName = (patient: PatientOption): string =>
  patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed Patient';

const getPatientLabel = (patient: PatientOption): string =>
  patient.email ? `${getPatientName(patient)} - ${patient.email}` : getPatientName(patient);

const normalizeSearchText = (value: string): string =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

const getDateOfBirth = (dateOfBirth?: string): string => {
  if (!dateOfBirth) return 'Date of birth not provided';
  const birthDate = new Date(dateOfBirth);
  return Number.isNaN(birthDate.getTime())
    ? 'Date of birth not provided'
    : birthDate.toLocaleDateString();
};

function PatientSelectInput<T extends FieldValues>({
  field,
  fieldState,
  patients,
  loading,
  error,
  onPatientSelected,
}: PatientSelectInputProps<T>) {
  const labelId = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedPatient = patients.find((patient) => patient.patientId === field.value);
  const normalizedQuery = normalizeSearchText(query);
  const matchingPatients = patients.filter((patient) => {
    if (!normalizedQuery) return true;
    return [patient.firstName, patient.lastName, getPatientName(patient), patient.email]
      .filter((value): value is string => Boolean(value))
      .some((value) => normalizeSearchText(value).includes(normalizedQuery));
  });
  const visibleText = isOpen ? query : selectedPatient ? getPatientLabel(selectedPatient) : query;

  useEffect(() => {
    onPatientSelected?.(selectedPatient || null);
  }, [field.value, patients, onPatientSelected, selectedPatient]);

  const selectPatient = (patient: PatientOption) => {
    field.onChange(patient.patientId);
    setQuery(getPatientLabel(patient));
    setIsOpen(false);
    setActiveIndex(0);
    onPatientSelected?.(patient);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (
        index < 0 ? 0 : Math.min(index + 1, matchingPatients.length - 1)
      ));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (
        index < 0 ? matchingPatients.length - 1 : Math.max(index - 1, 0)
      ));
    } else if (event.key === 'Enter' && isOpen && matchingPatients[activeIndex]) {
      event.preventDefault();
      selectPatient(matchingPatients[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery(selectedPatient ? getPatientLabel(selectedPatient) : '');
    }
  };

  return (
    <div className="relative">
      <Label id={labelId} htmlFor={`${listId}-input`} required>
        Select Patient
      </Label>
      <input
        {...field}
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-labelledby={labelId}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen && matchingPatients[activeIndex]
          ? `${listId}-option-${activeIndex}`
          : undefined}
        autoComplete="off"
        value={visibleText}
        onFocus={() => {
          setQuery('');
          setIsOpen(true);
        }}
        onBlur={() => {
          field.onBlur();
          setIsOpen(false);
          setQuery(selectedPatient ? getPatientLabel(selectedPatient) : '');
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          field.onChange('');
          onPatientSelected?.(null);
          setActiveIndex(-1);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type a patient name or email to search"
        className="w-full rounded-md border border-textPrimary/10 bg-surface px-3 py-2 text-sm text-textPrimary placeholder:text-textPrimary/50 focus:border-prescriptionPrimary focus:outline-none focus:ring-2 focus:ring-prescriptionPrimary/20"
      />

      {isOpen && (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-textPrimary/10 bg-surface shadow-sm"
        >
          {loading && <p className="px-3 py-2 text-sm text-textPrimary/70">Loading patients...</p>}
          {!loading && error && (
            <p role="alert" className="px-3 py-2 text-sm text-danger">{error}</p>
          )}
          {!loading && !error && matchingPatients.length === 0 && (
            <p className="px-3 py-2 text-sm text-textPrimary/70">No patients found</p>
          )}
          {!loading && !error && matchingPatients.map((patient, index) => (
            <div
              key={patient.patientId}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectPatient(patient)}
              className={`cursor-pointer border-b border-textPrimary/10 px-3 py-2 last:border-b-0 ${
                index === activeIndex ? 'bg-prescriptionPrimary/10' : 'bg-surface'
              }`}
            >
              <span className="block text-sm font-medium text-textPrimary">
                {getPatientLabel(patient)}
              </span>
              <span className="block text-xs text-textPrimary/70">
                DOB: {getDateOfBirth(patient.dateOfBirth)} · Phone: {patient.phone || 'Not provided'}
              </span>
            </div>
          ))}
        </div>
      )}

      {fieldState.error && (
        <p role="alert" className="mt-1 text-xs text-danger">{fieldState.error.message}</p>
      )}
    </div>
  );
}

export function PatientSelect<T extends FieldValues>({
  control,
  name,
  onPatientSelected,
  patients: providedPatients,
  patientsLoading,
  patientsError,
}: PatientSelectProps<T>) {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providedPatients !== undefined) return;
    let cancelled = false;
    const fetchPatients = async () => {
      try {
        const authorizedPatients = await fetchAuthorizedPatients();
        if (!cancelled) setPatients(authorizedPatients);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load patients.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchPatients();
    return () => {
      cancelled = true;
    };
  }, [providedPatients]);

  const patientOptions = providedPatients ?? patients;
  const isLoading = patientsLoading ?? loading;
  const loadError = patientsError ?? error;

  return (
    <Controller
      control={control}
      name={name}
      rules={{ required: 'Please choose a patient.' }}
      render={(props) => (
        <PatientSelectInput
          {...props}
          patients={patientOptions}
          loading={isLoading}
          error={loadError}
          onPatientSelected={onPatientSelected}
        />
      )}
    />
  );
}
