import { afterEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../frontend/src/shared/services/api', () => ({
  default: { get },
}));

import { fetchPatientVitals, parseVitalsResponse } from '../../../frontend/src/shared/services/vitals';

const vitalsFixture = {
  vitalsId: 'fixture-vitals-id',
  patientId: 'fixture-patient-uuid',
  bloodPressureSystolic: 120,
  bloodPressureDiastolic: 80,
  sugarLevel: 95,
  temperature: 36.8,
  heartRate: 72,
  pulseRate: 72,
  rbcCount: 4.5,
  wbcCount: 6000,
  recordedAt: '2026-10-19T12:00:00.000Z',
  analysis: { status: 'normal', message: 'Within expected range.', flaggedParams: [] },
};

describe('vitals service', () => {
  afterEach(() => get.mockReset());

  it('loads the authorized patient UUID endpoint and parses saved records', async () => {
    get.mockResolvedValue({ success: true, data: [vitalsFixture] });

    await expect(fetchPatientVitals('fixture-patient-uuid')).resolves.toEqual([vitalsFixture]);
    expect(get).toHaveBeenCalledWith('/vitals/patient/fixture-patient-uuid', { skipToast: true });
  });

  it('preserves an empty saved-history response and rejects a malformed envelope', () => {
    expect(parseVitalsResponse({ success: true, data: [] })).toEqual([]);
    expect(() => parseVitalsResponse({ success: true, data: {} })).toThrow(
      'The vitals service returned an invalid history response.'
    );
  });

  it('rejects unsuccessful responses even when they contain an empty data array', () => {
    expect(() => parseVitalsResponse({ success: false, data: [] })).toThrow(
      'The vitals service reported an unsuccessful response.'
    );
  });
});
