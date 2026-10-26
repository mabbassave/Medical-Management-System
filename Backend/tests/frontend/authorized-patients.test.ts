import { afterEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../frontend/src/shared/services/api', () => ({
  default: { get },
}));

import { fetchAuthorizedPatients, parseAuthorizedPatients } from '../../../frontend/src/shared/services/patients';

describe('authorized patient service', () => {
  afterEach(() => get.mockReset());

  it('fetches the protected roster and parses the backend success/data envelope', async () => {
    const authorizedPatients = [{ patientId: 'fixture-patient-id', fullName: 'Fixture Patient' }];
    get.mockResolvedValue({ success: true, data: authorizedPatients });

    await expect(fetchAuthorizedPatients()).resolves.toEqual(authorizedPatients);
    expect(get).toHaveBeenCalledWith('/patients', { skipToast: true });
  });

  it('accepts an empty authorized roster', () => {
    expect(parseAuthorizedPatients({ success: true, data: [] })).toEqual([]);
  });

  it('does not treat an unsuccessful server response as an empty roster', () => {
    expect(() => parseAuthorizedPatients({ success: false, data: [] })).toThrow(
      'The patient service reported an unsuccessful response.'
    );
  });

  it('rejects malformed data and patient IDs rather than treating them as an empty roster', () => {
    expect(() => parseAuthorizedPatients({ success: true, data: {} })).toThrow(
      'The patient service returned an invalid patient list.'
    );
    expect(() => parseAuthorizedPatients({ success: true, data: [{ patientId: 17 }] })).toThrow(
      'The patient service returned an invalid patient list.'
    );
  });
});
