import { describe, expect, it } from 'vitest';
import { UserModel, userSchema } from '../../src/infrastructure/database/schemas/User.schema';
import { PatientModel } from '../../src/infrastructure/database/schemas/Patient.schema';
import { DoctorModel } from '../../src/infrastructure/database/schemas/Doctor.schema';
import { registerSchema } from '../../src/presentation/schemas';

describe('MongoDB user account schema', () => {
  it('normalizes email and assigns password auth and not-enrolled face defaults', async () => {
    const user = new UserModel({
      username: 'Sample Patient',
      email: '  SAMPLE@Example.com ',
      password: '$2b$10$hashed-password',
    });

    expect(user.email).toBe('sample@example.com');
    expect(user.authProvider).toBe('password');
    expect(user.faceEnrollmentStatus).toBe('not_enrolled');
    expect(user.role).toBe('patient');
    await expect(user.validate()).resolves.toBeUndefined();
  });

  it('validates and trims registration input on the server', () => {
    expect(
      registerSchema.parse({
        username: '  Sample Patient  ',
        email: '  SAMPLE@Example.com ',
        password: 'securePassword123',
      })
    ).toEqual({
      username: 'Sample Patient',
      email: 'SAMPLE@Example.com',
      password: 'securePassword123',
    });

    expect(
      registerSchema.safeParse({
        username: 'x'.repeat(81),
        email: 'sample@example.com',
        password: 'securePassword123',
      }).success
    ).toBe(false);
  });

  it('uses unique indexes for account identifiers, not password hashes', () => {
    const indexes = userSchema.indexes();
    const uniqueSingleFieldIndexes = indexes
      .filter(([spec, options]) => options.unique && Object.keys(spec).length === 1)
      .map(([spec]) => Object.keys(spec)[0]);

    expect(uniqueSingleFieldIndexes).toContain('email');
    expect(uniqueSingleFieldIndexes).toContain('username');
    expect(uniqueSingleFieldIndexes).not.toContain('password');
  });

  it('uniquely maps verified provider subjects and timestamps user records', () => {
    const providerIdentityIndex = userSchema.indexes().find(
      ([spec, options]) =>
        'authProvider' in spec &&
        'providerSubject' in spec &&
        options.unique === true
    );

    expect(providerIdentityIndex?.[1].partialFilterExpression).toEqual({
      providerSubject: { $type: 'string' },
    });
    expect(userSchema.options.timestamps).toBe(true);
    expect(userSchema.path('lastLoginAt')).toBeDefined();
  });

  it('enforces unique Google identities independently of the account login provider', () => {
    const googleSubjectIndex = userSchema.indexes().find(
      ([spec, options]) => 'googleSubject' in spec && options.unique === true
    );

    expect(googleSubjectIndex?.[1].sparse).toBe(true);
  });

  it('does not return password hashes in ordinary user queries', () => {
    expect(userSchema.path('password').options.select).toBe(false);
  });

  it('supports provider accounts without creating a password credential', async () => {
    const user = new UserModel({
      username: 'Google Patient',
      email: 'google@example.com',
      authProvider: 'google',
      providerSubject: 'google-subject-123',
    });

    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.password).toBeUndefined();
  });

  it('persists phone number, full name, status, and verification flags correctly', async () => {
    const user = new UserModel({
      username: 'Sarah Connor',
      fullName: 'Sarah Connor',
      email: 'sarah@example.com',
      phoneNumber: '+14155552671',
      phone: '+14155552671',
      password: '$2b$10$hashed-password-12345',
      role: 'patient',
    });

    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.phoneNumber).toBe('+14155552671');
    expect(user.phone).toBe('+14155552671');
    expect(user.fullName).toBe('Sarah Connor');
    expect(user.status).toBe('active');
    expect(user.isEmailVerified).toBe(false);
    expect(user.isPhoneVerified).toBe(false);
  });

  it('allows a patient profile with only a linked ID and email', async () => {
    const patient = new PatientModel({
      patientId: 'patient-profile-id',
      email: '  PATIENT@EXAMPLE.COM ',
      userId: new UserModel({ username: 'Patient Name', email: 'patient@example.com' })._id,
    });

    await expect(patient.validate()).resolves.toBeUndefined();
    expect(patient.email).toBe('patient@example.com');
    expect(patient.phone).toBeUndefined();
    expect(patient.dateOfBirth).toBeUndefined();
    expect(patient.firstName).toBeUndefined();
    expect(patient.lastName).toBeUndefined();
  });

  it('allows a doctor profile without unprovided professional details', async () => {
    const doctor = new DoctorModel({
      doctorId: 'doctor-profile-id',
      email: 'doctor@example.com',
    });

    await expect(doctor.validate()).resolves.toBeUndefined();
    expect(doctor.phone).toBeUndefined();
    expect(doctor.specialization).toBeUndefined();
    expect(doctor.licenseNumber).toBeUndefined();
  });
});
