import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureUserProfile } from '../../src/infrastructure/database/UserProfileLinker';
import { DoctorModel } from '../../src/infrastructure/database/schemas/Doctor.schema';
import { PatientModel } from '../../src/infrastructure/database/schemas/Patient.schema';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';

describe('authenticated profile linking', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a patient profile with the submitted name and normalized email only', async () => {
    const user = new UserModel({
      username: 'Ada Lovelace',
      fullName: 'Ada Lovelace',
      email: ' ADA@EXAMPLE.COM ',
      password: '$2b$10$hashed-password',
      role: 'patient',
    });
    const create = vi.spyOn(PatientModel, 'create').mockResolvedValue({
      patientId: 'patient-profile-id',
    } as never);
    vi.spyOn(PatientModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(UserModel.prototype, 'save').mockResolvedValue(user as never);

    await expect(ensureUserProfile(user)).resolves.toBe('patient-profile-id');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      patientId: expect.any(String),
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      userId: user._id,
    }));
    const patientFields = create.mock.calls[0][0] as Record<string, unknown>;
    expect(patientFields).not.toHaveProperty('phone');
    expect(patientFields).not.toHaveProperty('dateOfBirth');
    expect(user.linkedId).toBe('patient-profile-id');
  });

  it('stores only professional details explicitly provided for a doctor', async () => {
    const user = new UserModel({
      username: 'Grace Hopper',
      fullName: 'Grace Hopper',
      email: 'GRACE@EXAMPLE.COM',
      password: '$2b$10$hashed-password',
      role: 'doctor',
      phoneNumber: '+14155552671',
      specialty: 'Computer Science',
      licenseNumber: 'LIC-12345',
      doctorVerificationStatus: 'verified',
    });
    const create = vi.spyOn(DoctorModel, 'create').mockResolvedValue({
      doctorId: 'doctor-profile-id',
    } as never);
    vi.spyOn(DoctorModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(UserModel.prototype, 'save').mockResolvedValue(user as never);

    await expect(ensureUserProfile(user)).resolves.toBe('doctor-profile-id');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      doctorId: expect.any(String),
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      userId: user._id,
      phone: '+14155552671',
      specialization: 'Computer Science',
      licenseNumber: 'LIC-12345',
    }));
    expect(user.linkedId).toBe('doctor-profile-id');
    expect(user.doctorVerificationStatus).toBe('verified');
  });
});
