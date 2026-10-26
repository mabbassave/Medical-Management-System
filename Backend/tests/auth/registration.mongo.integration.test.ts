import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { generateKeyPair, SignJWT } from 'jose';
import type { Request, Response } from 'express';
import { AuthController } from '../../src/presentation/controllers/Auth.controller';
import { findOrCreateOAuthUser, verifyProviderIdentityToken } from '../../src/infrastructure/auth/OAuthService';
import { ensureUserProfile } from '../../src/infrastructure/database/UserProfileLinker';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';
import { PatientModel } from '../../src/infrastructure/database/schemas/Patient.schema';
import { DoctorModel } from '../../src/infrastructure/database/schemas/Doctor.schema';

const mongoTestUri = process.env.MONGODB_TEST_URI;
const testDatabaseName = `medivanta_registration_test_${randomUUID().replace(/-/g, '')}`;
const suffix = testDatabaseName.slice(-8);

describe.skipIf(!mongoTestUri)('MongoDB registration persistence integration', () => {
  beforeAll(async () => {
    await mongoose.connect(mongoTestUri!, { dbName: testDatabaseName, serverSelectionTimeoutMS: 5000 });
    await Promise.all([UserModel.init(), PatientModel.init(), DoctorModel.init()]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('persists password and verified Google registrations with the correct profiles and unset fields', async () => {
    const registerWithPassword = async (body: Record<string, unknown>) => {
      let status = 0;
      let responseBody: { user?: { id: string } } = {};
      let nextError: unknown;
      const response = {
        status(value: number) {
          status = value;
          return this;
        },
        json(value: { user?: { id: string } }) {
          responseBody = value;
          return this;
        },
      };

      await new AuthController().register(
        { body } as Request,
        response as unknown as Response,
        (error?: unknown) => {
          nextError = error;
        }
      );

      if (nextError) throw nextError;
      expect(status).toBe(201);
      expect(responseBody.user?.id).toBeTruthy();
    };

    const emailPatient = {
      username: `Email Patient ${suffix}`,
      fullName: `Email Patient ${suffix}`,
      email: `password.patient.${suffix}@example.invalid`,
      phoneNumber: '+12025550142',
      password: 'securePassword123',
      role: 'patient',
    };
    const emailDoctor = {
      username: `Email Doctor ${suffix}`,
      fullName: `Email Doctor ${suffix}`,
      email: `password.doctor.${suffix}@example.invalid`,
      phoneNumber: '+12025550143',
      password: 'securePassword123',
      role: 'doctor',
      specialty: 'Integration Test Specialty',
      licenseNumber: `TEST-LIC-${suffix}`,
    };
    await registerWithPassword(emailPatient);
    await registerWithPassword(emailDoctor);
    await expect(registerWithPassword({
      ...emailPatient,
      username: `Second Patient ${suffix}`,
    })).rejects.toMatchObject({
      statusCode: 409,
      message: 'This user is already registered. Please log in.',
    });

    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const createGoogleAccount = async (role: 'patient' | 'doctor', name: string) => {
      const email = `google.${role}.${suffix}@example.invalid`;
      const nonce = `nonce-${suffix}`;
      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({
        sub: `google-${role}-${suffix}`,
        nonce,
        email,
        email_verified: true,
        name,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('integration-client-id')
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(privateKey);
      const identity = await verifyProviderIdentityToken(
        'google',
        token,
        nonce,
        'integration-client-id',
        async () => publicKey
      );
      const { user, created } = await findOrCreateOAuthUser(identity, role, 'register');
      expect(created).toBe(true);
      await ensureUserProfile(user);
      return { email, name, identity };
    };

    const googlePatient = await createGoogleAccount('patient', `Google Patient ${suffix}`);
    const googleDoctor = await createGoogleAccount('doctor', `Google Doctor ${suffix}`);
    await expect(
      findOrCreateOAuthUser(googlePatient.identity, 'doctor', 'register')
    ).rejects.toThrow('oauth_already_registered');
    const existingGoogleLogin = await findOrCreateOAuthUser(
      googlePatient.identity,
      'doctor',
      'login'
    );
    expect(existingGoogleLogin.created).toBe(false);
    expect(existingGoogleLogin.user.role).toBe('patient');
    expect(existingGoogleLogin.user.fullName).toBe(googlePatient.name);

    const raceEmail = `google.race.${suffix}@example.invalid`;
    const raceIdentity = {
      provider: 'google' as const,
      subject: `google-race-${suffix}`,
      email: raceEmail,
      displayName: `Google Race ${suffix}`,
    };
    const concurrentAttempts = await Promise.allSettled([
      findOrCreateOAuthUser(raceIdentity, 'patient', 'register'),
      findOrCreateOAuthUser(raceIdentity, 'doctor', 'register'),
    ]);
    const concurrentSuccesses = concurrentAttempts.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof findOrCreateOAuthUser>>> =>
        result.status === 'fulfilled'
    );
    const concurrentFailures = concurrentAttempts.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    expect(concurrentSuccesses).toHaveLength(1);
    expect(concurrentFailures).toHaveLength(1);
    expect(concurrentFailures[0].reason.message).toBe('oauth_already_registered');
    await ensureUserProfile(concurrentSuccesses[0].value.user);

    const assertPatient = async (email: string, name: string) => {
      const user = await UserModel.findOne({ email }).orFail();
      expect(user.fullName).toBe(name);
      expect(user.role).toBe('patient');
      const profile = await PatientModel.findOne({ userId: user._id }).orFail();
      expect(profile.patientId).toBe(user.linkedId);
      expect(profile.email).toBe(user.email);
      expect(profile.userId?.toString()).toBe(user._id.toString());
      expect(`${profile.firstName} ${profile.lastName}`).toBe(name);
      return profile;
    };
    const assertDoctor = async (email: string, name: string) => {
      const user = await UserModel.findOne({ email }).orFail();
      expect(user.fullName).toBe(name);
      expect(user.role).toBe('doctor');
      expect(user.doctorVerificationStatus).toBe('verified');
      const profile = await DoctorModel.findOne({ userId: user._id }).orFail();
      expect(profile.doctorId).toBe(user.linkedId);
      expect(profile.email).toBe(user.email);
      expect(profile.userId?.toString()).toBe(user._id.toString());
      expect(`${profile.firstName} ${profile.lastName}`).toBe(name);
      return profile;
    };

    const passwordPatient = await assertPatient(emailPatient.email, emailPatient.fullName);
    const passwordDoctor = await assertDoctor(emailDoctor.email, emailDoctor.fullName);
    const oauthPatient = await assertPatient(googlePatient.email, googlePatient.name);
    const oauthDoctor = await assertDoctor(googleDoctor.email, googleDoctor.name);

    assert.equal(passwordPatient.phone, emailPatient.phoneNumber);
    assert.equal(passwordPatient.dateOfBirth, undefined);
    assert.equal(passwordDoctor.phone, emailDoctor.phoneNumber);
    assert.equal(passwordDoctor.specialization, emailDoctor.specialty);
    assert.equal(passwordDoctor.licenseNumber, emailDoctor.licenseNumber);
    assert.equal(oauthPatient.phone, undefined);
    assert.equal(oauthPatient.dateOfBirth, undefined);
    assert.equal(oauthDoctor.phone, undefined);
    assert.equal(oauthDoctor.specialization, undefined);
    assert.equal(oauthDoctor.licenseNumber, undefined);
    expect(await UserModel.countDocuments()).toBe(5);
    expect(await PatientModel.countDocuments()).toBe(3);
    expect(await DoctorModel.countDocuments()).toBe(2);
  }, 30000);
});
