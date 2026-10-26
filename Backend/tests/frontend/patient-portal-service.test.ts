import { describe, expect, it } from 'vitest';
import { parsePatientPortalList } from '../../../frontend/src/shared/services/patientPortal';

describe('patient portal list response parsing', () => {
  it('reads saved records from the backend success/data envelope', () => {
    const records = [{ patientId: 'patient-uuid' }];
    expect(parsePatientPortalList({ success: true, data: records }, 'appointments')).toEqual(records);
  });

  it('keeps a genuine empty result empty', () => {
    expect(parsePatientPortalList({ success: true, data: [] }, 'vitals')).toEqual([]);
  });

  it('surfaces unsuccessful and malformed responses instead of hiding them as empty data', () => {
    expect(() => parsePatientPortalList({ success: false, data: [] }, 'appointments'))
      .toThrow('The appointments service reported an unsuccessful response.');
    expect(() => parsePatientPortalList({ success: true, data: {} }, 'prescriptions'))
      .toThrow('The prescriptions service returned an invalid list response.');
    expect(() => parsePatientPortalList(null, 'vitals'))
      .toThrow('The vitals service returned an invalid list response.');
  });
});
