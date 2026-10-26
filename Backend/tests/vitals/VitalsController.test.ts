import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VitalsController } from '../../src/presentation/controllers/Vitals.controller';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';
import { VitalsModel } from '../../src/infrastructure/database/schemas/Vitals.schema';
import * as ProfileLinker from '../../src/infrastructure/database/UserProfileLinker';

describe('VitalsController.getVitalsByPatient', () => {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  const getVitalsByPatient = vi.fn();
  const controller = new VitalsController({ getVitalsByPatient } as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a patient\'s own records by the canonical linked profile ID', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient', linkedId: 'stale-id' } as never);
    vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('current-patient-id');
    getVitalsByPatient.mockResolvedValue([]);
    const req = {
      user: { userId: 'patient-user-id', role: 'patient', linkedId: 'stale-id' },
      params: { patientId: 'current-patient-id' },
    };

    await controller.getVitalsByPatient(req as never, response as never, next);

    expect(getVitalsByPatient).toHaveBeenCalledWith('current-patient-id');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(next).not.toHaveBeenCalled();
  });

  it('loads the selected assigned patient ID for a doctor request', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'doctor' } as never);
    getVitalsByPatient.mockResolvedValue([]);
    const req = {
      user: { userId: 'doctor-user-id', role: 'doctor', linkedId: 'doctor-profile-id' },
      params: { patientId: 'assigned-patient-id' },
    };

    await controller.getVitalsByPatient(req as never, response as never, next);

    expect(getVitalsByPatient).toHaveBeenCalledWith('assigned-patient-id');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('VitalsController optical scan history', () => {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  const controller = new VitalsController({} as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only the authenticated patient’s scans', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient' } as never);
    vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('own-patient-id');
    const scans = [{ vitalsId: 'scan-1', patientId: 'own-patient-id', heartRate: 72 }];
    const lean = vi.fn().mockResolvedValue(scans);
    const sort = vi.fn().mockReturnValue({ lean });
    const find = vi.spyOn(VitalsModel, 'find').mockReturnValue({ sort } as never);

    await controller.getMyScanHistory(
      { user: { userId: 'patient-user-id', role: 'patient' } } as never,
      response as never,
      next
    );

    expect(find).toHaveBeenCalledWith({ patientId: 'own-patient-id' });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: [expect.objectContaining({ vitalsId: 'scan-1', patientId: 'own-patient-id', heartRate: 72 })],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('saves a patient scan against the authenticated patient profile', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient' } as never);
    vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('own-patient-id');
    const createdScan = {
      vitalsId: 'scan-1',
      patientId: 'own-patient-id',
      selectedMetrics: ['heartRate'],
      heartRate: 72,
      status: 'inconclusive',
      message: 'Estimated values for general wellness.',
    };
    const create = vi.spyOn(VitalsModel, 'create').mockResolvedValue(createdScan as never);

    await controller.recordVitals(
      {
        user: { userId: 'patient-user-id', role: 'patient' },
        body: { selectedMetrics: ['heartRate'], heartRate: 72, scanDuration: 30 },
      } as never,
      response as never,
      next
    );

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'own-patient-id',
      selectedMetrics: ['heartRate'],
      heartRate: 72,
    }));
    expect(create.mock.calls[0][0]).not.toHaveProperty('doctorId');
    expect(response.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});
