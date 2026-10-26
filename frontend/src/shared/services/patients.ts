import api from './api';

export interface AuthorizedPatient {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
}

export const parseAuthorizedPatients = (response: unknown): AuthorizedPatient[] => {
  if (response && typeof response === 'object' && 'success' in response && response.success !== true) {
    throw new Error('The patient service reported an unsuccessful response.');
  }

  const patients = Array.isArray(response)
    ? response
    : response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)
      ? response.data
      : null;

  if (!patients || patients.some((patient) =>
    !patient || typeof patient !== 'object' || !('patientId' in patient) || typeof patient.patientId !== 'string'
  )) {
    throw new Error('The patient service returned an invalid patient list.');
  }

  return patients as AuthorizedPatient[];
};

export const fetchAuthorizedPatients = async (): Promise<AuthorizedPatient[]> =>
  parseAuthorizedPatients(await api.get('/patients', { skipToast: true }));
