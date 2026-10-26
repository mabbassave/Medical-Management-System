import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from '../../src/presentation/controllers/Auth.controller';
import { PasswordHasher } from '../../src/infrastructure/auth/PasswordHasher';
import * as ProfileLinker from '../../src/infrastructure/database/UserProfileLinker';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';

describe('email and password registration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const submitRegistration = async (body: Record<string, unknown>) => {
    vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(PasswordHasher, 'hashPassword').mockResolvedValue('hashed-password');
    vi.spyOn(UserModel.prototype, 'save').mockResolvedValue(undefined as never);
    const ensureProfile = vi
      .spyOn(ProfileLinker, 'ensureUserProfile')
      .mockResolvedValue(body.role === 'doctor' ? 'doctor-profile-id' : 'patient-profile-id');
    const response = {
      cookie: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await new AuthController().register(
      { body } as Request,
      response,
      next
    );

    return { response, next, ensureProfile };
  };

  it('persists the submitted patient name, normalized email, role, and profile link', async () => {
    const { response, next, ensureProfile } = await submitRegistration({
      username: '  Ada Lovelace  ',
      fullName: '  Ada Lovelace  ',
      email: '  ADA@EXAMPLE.COM ',
      password: 'securePassword123',
      role: 'patient',
    });

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(201);
    expect(ensureProfile).toHaveBeenCalledWith(expect.objectContaining({
      username: 'Ada Lovelace',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'patient',
    }));
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        role: 'patient',
        patientId: 'patient-profile-id',
      }),
    }));
  });

  it('persists doctor details only as submitted and marks the account verified', async () => {
    const { response, next, ensureProfile } = await submitRegistration({
      username: 'Grace Hopper',
      fullName: 'Grace Hopper',
      email: 'Grace@Example.com',
      password: 'securePassword123',
      role: 'doctor',
      phoneNumber: '+14155552671',
      specialty: 'Computer Science',
      licenseNumber: 'LIC-12345',
    });

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(201);
    expect(ensureProfile).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'Grace Hopper',
      email: 'grace@example.com',
      role: 'doctor',
      phoneNumber: '+14155552671',
      specialty: 'Computer Science',
      licenseNumber: 'LIC-12345',
      doctorVerificationStatus: 'verified',
    }));
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({
        fullName: 'Grace Hopper',
        email: 'grace@example.com',
        role: 'doctor',
        doctorId: 'doctor-profile-id',
        doctorVerificationStatus: 'verified',
      }),
    }));
  });

  it('rejects an existing email with the login instruction before hashing or saving', async () => {
    const existingUser = { _id: 'existing-account' };
    const findOne = vi
      .spyOn(UserModel, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser as never);
    const hashPassword = vi.spyOn(PasswordHasher, 'hashPassword');
    const save = vi.spyOn(UserModel.prototype, 'save');
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await new AuthController().register(
      {
        body: {
          username: 'New User',
          email: ' existing@example.com ',
          password: 'securePassword123',
          role: 'patient',
        },
      } as Request,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 409,
      message: 'This user is already registered. Please log in.',
    }));
    expect(hashPassword).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    findOne.mockRestore();
  });
});
