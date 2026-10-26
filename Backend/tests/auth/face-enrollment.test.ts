import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FaceEnrollmentService,
  faceEnrollmentService,
} from '../../src/infrastructure/biometrics/FaceEnrollmentService';
import { faceEmbeddingService } from '../../src/infrastructure/biometrics/FaceEmbeddingService';
import { FaceTemplateCrypto } from '../../src/infrastructure/biometrics/FaceTemplateCrypto';
import { JwtService } from '../../src/infrastructure/auth/JwtService';
import { AuthController } from '../../src/presentation/controllers/Auth.controller';
import type { AuthenticatedRequest } from '../../src/presentation/middlewares/auth.middleware';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';
import { env } from '../../src/infrastructure/config/env';
import type { Response } from 'express';

const configuration = {
  enabled: true,
  encryptionKeyConfigured: true,
};

const configuredEnrollmentFlag = env.FACE_ENROLLMENT_ENABLED;
const configuredEncryptionKey = env.BIOMETRIC_ENCRYPTION_KEY;
afterEach(() => {
  env.FACE_ENROLLMENT_ENABLED = configuredEnrollmentFlag;
  env.BIOMETRIC_ENCRYPTION_KEY = configuredEncryptionKey;
  vi.restoreAllMocks();
});

describe('local face enrollment', () => {
  it('extracts a server-side embedding and stores only its encrypted template', async () => {
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const template = Buffer.alloc(512, 3);
    const extract = vi.spyOn(faceEmbeddingService, 'extract').mockResolvedValue(template);
    const service = new FaceEnrollmentService(configuration);
    const image = Buffer.from('jpeg bytes');

    const encrypted = await service.enrollFace('user-object-id', image);
    expect(extract).toHaveBeenCalledWith(image);
    expect(encrypted).not.toEqual(template);
    expect(new FaceTemplateCrypto().decrypt(encrypted, 'user-object-id')).toEqual(template);
  });

  it('rejects tampered encrypted templates', () => {
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const crypto = new FaceTemplateCrypto();
    const encrypted = crypto.encrypt(Buffer.alloc(512, 3), 'account-id');
    encrypted[encrypted.length - 1] ^= 1;
    expect(() => crypto.decrypt(encrypted, 'account-id')).toThrow('stored face template cannot be read');
    expect(() => crypto.decrypt(crypto.encrypt(Buffer.alloc(512, 3), 'account-a'), 'account-b'))
      .toThrow('stored face template cannot be read');
  });

  it('fails closed when local enrollment is disabled', async () => {
    const extract = vi.spyOn(faceEmbeddingService, 'extract');
    const service = new FaceEnrollmentService({ enabled: false, encryptionKeyConfigured: false });

    await expect(service.enrollFace('user-object-id', Buffer.from('jpeg bytes'))).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(extract).not.toHaveBeenCalled();
  });
});

describe('face enrollment tickets', () => {
  it('issues a scoped short-lived Patient/Doctor ticket and rejects normal session tokens as tickets', () => {
    const ticket = JwtService.generateFaceEnrollmentToken('account-id', 'doctor');

    expect(JwtService.verifyFaceEnrollmentToken(ticket)).toMatchObject({
      userId: 'account-id',
      role: 'doctor',
      scope: 'face_enrollment',
    });
    expect(() => JwtService.verifyFaceEnrollmentToken(
      JwtService.generateToken('account-id', 'doctor')
    )).toThrow('Invalid face enrollment ticket');
  });
});

describe('authenticated face enrollment association', () => {
  it.each([
    ['patient', 'patient-account-id'],
    ['doctor', 'doctor-account-id'],
  ] as const)('persists only the encrypted template on the %s account', async (role, userId) => {
    env.FACE_ENROLLMENT_ENABLED = true;
    const encryptedTemplate = Buffer.from('opaque encrypted template');
    const user = {
      _id: { toString: () => userId },
      role,
      status: 'active',
      faceEnrollmentStatus: 'not_enrolled',
      doctorVerificationStatus: role === 'doctor' ? 'verified' : undefined,
    };
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    } as never);
    const persistedConsentAt = new Date();
    const persistedTemplate = Buffer.from('opaque encrypted template');
    const persistedUser = {
        ...user,
        faceEnrollmentStatus: 'enrolled',
        faceTemplateEncrypted: persistedTemplate,
        faceConsentAt: persistedConsentAt,
      };
    const persistedQuery = { select: vi.fn().mockResolvedValue(persistedUser) };
    const findOneAndUpdate = vi.spyOn(UserModel, 'findOneAndUpdate')
      .mockReturnValueOnce(user as never)
      .mockReturnValueOnce(persistedQuery as never);
    const enrollFace = vi.spyOn(faceEnrollmentService, 'enrollFace').mockResolvedValue(encryptedTemplate);
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const clearCookie = vi.fn();
    const response = { status, json, clearCookie } as unknown as Response;
    const next = vi.fn();

    await new AuthController().enrollFace(
      {
        user: { userId, role },
        body: { consent: 'true' },
        file: { buffer: Buffer.from('camera frame') },
      } as unknown as AuthenticatedRequest,
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(enrollFace).toHaveBeenCalledWith(userId, Buffer.from('camera frame'));
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ _id: user._id, role, status: 'active' }),
      expect.objectContaining({
        $set: expect.objectContaining({ faceEnrollmentStatus: 'enrolling' }),
      }),
      { new: true }
    );
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        _id: user._id,
        role,
        status: 'active',
        faceEnrollmentStatus: 'enrolling',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          faceEnrollmentStatus: 'enrolled',
          faceTemplateEncrypted: encryptedTemplate,
          faceConsentAt: expect.any(Date),
        }),
      }),
      { new: true }
    );
    expect(persistedQuery.select).toHaveBeenCalledWith('+faceTemplateEncrypted');
    expect(enrollFace).toHaveBeenCalledWith(userId, Buffer.from('camera frame'));
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      enrolled: true,
      role,
      faceEnrollmentStatus: 'enrolled',
    }));
    expect(JSON.stringify(json.mock.calls)).not.toContain(encryptedTemplate.toString());
  });

  it('does not report success when the stored enrollment is missing its consent timestamp', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    const userId = 'patient-account-id';
    const user = {
      _id: { toString: () => userId },
      role: 'patient',
      status: 'active',
      faceEnrollmentStatus: 'not_enrolled',
    };
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    } as never);
    vi.spyOn(UserModel, 'findOneAndUpdate')
      .mockResolvedValueOnce(user as never)
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({
          ...user,
          faceEnrollmentStatus: 'enrolled',
          faceTemplateEncrypted: Buffer.from('encrypted template'),
        }),
      } as never);
    const updateOne = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    vi.spyOn(faceEnrollmentService, 'enrollFace').mockResolvedValue(Buffer.from('encrypted template'));
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const next = vi.fn();

    await new AuthController().enrollFace(
      {
        user: { userId, role: 'patient' },
        body: { consent: 'true' },
        file: { buffer: Buffer.from('camera frame') },
      } as unknown as AuthenticatedRequest,
      { status, json } as unknown as Response,
      next
    );

    expect(status).not.toHaveBeenCalledWith(201);
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 409,
      message: 'The enrollment session expired before it could be saved. Please retry.',
    }));
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: userId, faceEnrollmentStatus: 'enrolling' }),
      expect.objectContaining({
        $set: { faceEnrollmentStatus: 'not_enrolled' },
      })
    );
  });
});

describe('biometric template deletion', () => {
  it('clears the template, consent, and enrollment metadata for the authenticated account', async () => {
    const findOneAndUpdate = vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue({
      faceEnrollmentStatus: 'not_enrolled',
    } as never);
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const next = vi.fn();

    await new AuthController().deleteFaceEnrollment(
      { user: { userId: 'patient-account-id', role: 'patient' } } as never,
      { status, json } as never,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'patient-account-id', role: { $in: ['patient', 'doctor'] } },
      expect.objectContaining({
        $set: { faceEnrollmentStatus: 'not_enrolled' },
        $unset: expect.objectContaining({
          faceTemplateEncrypted: '',
          faceConsentAt: '',
          faceEnrolledAt: '',
        }),
      }),
      { new: true }
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ deleted: true }));
  });
});
