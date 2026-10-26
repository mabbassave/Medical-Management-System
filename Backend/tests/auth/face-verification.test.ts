import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AppError } from '../../src/domain/errors/AppError';
import { FaceVerificationError } from '../../src/domain/errors/FaceVerificationError';
import { JwtService } from '../../src/infrastructure/auth/JwtService';
import * as ProfileLinker from '../../src/infrastructure/database/UserProfileLinker';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';
import { env } from '../../src/infrastructure/config/env';
import { FaceVerificationService } from '../../src/infrastructure/biometrics/FaceVerificationService';
import { faceVerificationService } from '../../src/infrastructure/biometrics/FaceVerificationService';
import { faceEmbeddingService } from '../../src/infrastructure/biometrics/FaceEmbeddingService';
import { FaceTemplateCrypto } from '../../src/infrastructure/biometrics/FaceTemplateCrypto';
import { AuthController } from '../../src/presentation/controllers/Auth.controller';
import { errorMiddleware } from '../../src/presentation/middlewares/error.middleware';

const configuration = {
  enabled: true,
  encryptionKeyConfigured: true,
};

const mockFaceUsersQuery = (users: unknown[]) => Object.assign([...users], {
  select: vi.fn().mockResolvedValue(users),
});

const configuredEnrollmentFlag = env.FACE_ENROLLMENT_ENABLED;
const configuredEncryptionKey = env.BIOMETRIC_ENCRYPTION_KEY;
const configuredDevelopmentFlag = env.isDevelopment;
afterEach(() => {
  env.FACE_ENROLLMENT_ENABLED = configuredEnrollmentFlag;
  env.BIOMETRIC_ENCRYPTION_KEY = configuredEncryptionKey;
  env.isDevelopment = configuredDevelopmentFlag;
  vi.restoreAllMocks();
});

describe('face verification diagnostic responses', () => {
  it('includes only the safe diagnostic code in development responses', () => {
    env.isDevelopment = true;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    errorMiddleware(
      new FaceVerificationError(401, 'Face mismatch.', 'FACE_MISMATCH'),
      {} as Request,
      { status, json } as unknown as Response,
      vi.fn()
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Face mismatch.',
      diagnosticCode: 'FACE_MISMATCH',
    });
  });

  it('does not expose diagnostic codes in production responses', () => {
    env.isDevelopment = false;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    errorMiddleware(
      new FaceVerificationError(409, 'Enrollment missing.', 'FACE_TEMPLATE_MISSING'),
      {} as Request,
      { status, json } as unknown as Response,
      vi.fn()
    );

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Enrollment missing.',
    });
  });
});

describe('local face verification', () => {
  it('matches an encrypted enrolled embedding and rejects a different embedding', async () => {
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const vector = Buffer.alloc(128 * 4);
    vector.writeFloatLE(1, 0);
    const wrongVector = Buffer.alloc(128 * 4);
    wrongVector.writeFloatLE(-1, 0);
    const crypto = new FaceTemplateCrypto();
    const accountId = 'patient-account-id';
    const find = vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([{
      _id: { toString: () => accountId },
      faceTemplateEncrypted: crypto.encrypt(vector, accountId),
    }]) as never);
    const extract = vi.spyOn(faceEmbeddingService, 'extract').mockResolvedValue(vector);
    const service = new FaceVerificationService(configuration);

    await expect(service.findMatchingFaces(Buffer.from('camera frame'))).resolves.toEqual([
      { userId: accountId, similarity: 1 },
    ]);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      role: { $in: ['patient', 'doctor'] },
      status: 'active',
      faceEnrollmentStatus: 'enrolled',
      faceConsentAt: { $type: 'date' },
    }));

    extract.mockResolvedValueOnce(wrongVector);
    await expect(service.findMatchingFaces(Buffer.from('wrong face'))).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringContaining('did not match an enrolled face'),
    });
  });

  it('reports a missing template and asks the user to re-enroll', async () => {
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(faceEmbeddingService, 'extract').mockResolvedValue(Buffer.alloc(128 * 4, 0));
    vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([{
      _id: { toString: () => 'account-without-template' },
      faceTemplateEncrypted: undefined,
    }]) as never);

    await expect(
      new FaceVerificationService(configuration).findMatchingFaces(Buffer.from('camera frame'))
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('no saved template'),
      diagnosticCode: 'FACE_TEMPLATE_MISSING',
    });
    expect(info).not.toHaveBeenCalled();
  });

  it('reports a corrupted or account-mismatched template as unreadable', async () => {
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const template = Buffer.alloc(128 * 4);
    template.writeFloatLE(1, 0);
    const encrypted = new FaceTemplateCrypto().encrypt(template, 'different-account-id');
    vi.spyOn(faceEmbeddingService, 'extract').mockResolvedValue(template);
    vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([{
      _id: { toString: () => 'account-id' },
      faceTemplateEncrypted: encrypted,
    }]) as never);

    await expect(
      new FaceVerificationService(configuration).findMatchingFaces(Buffer.from('camera frame'))
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining('could not be decrypted'),
      diagnosticCode: 'FACE_TEMPLATE_UNREADABLE',
    });
    expect(info).not.toHaveBeenCalled();
  });

  it('reports a template whose authenticated ciphertext was corrupted as unreadable', async () => {
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const crypto = new FaceTemplateCrypto();
    const template = Buffer.alloc(128 * 4);
    template.writeFloatLE(1, 0);
    const encrypted = crypto.encrypt(template, 'account-id');
    encrypted[encrypted.length - 1] ^= 1;
    vi.spyOn(faceEmbeddingService, 'extract').mockResolvedValue(template);
    vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([{
      _id: { toString: () => 'account-id' },
      faceTemplateEncrypted: encrypted,
    }]) as never);

    await expect(
      new FaceVerificationService(configuration).findMatchingFaces(Buffer.from('camera frame'))
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining('could not be decrypted'),
    });
    expect(info).not.toHaveBeenCalled();
  });

  it('returns unauthorized only when readable templates do not meet the similarity threshold', async () => {
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const candidate = Buffer.alloc(128 * 4);
    candidate.writeFloatLE(1, 0);
    const differentFace = Buffer.alloc(128 * 4);
    differentFace.writeFloatLE(-1, 0);
    const accountId = 'patient-account-id';
    const encrypted = new FaceTemplateCrypto().encrypt(differentFace, accountId);
    vi.spyOn(faceEmbeddingService, 'extract').mockResolvedValue(candidate);
    vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([{
      _id: { toString: () => accountId },
      faceTemplateEncrypted: encrypted,
    }]) as never);

    await expect(
      new FaceVerificationService(configuration).findMatchingFaces(Buffer.from('different face'))
    ).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringContaining('did not match an enrolled face'),
      diagnosticCode: 'FACE_MISMATCH',
    });
  });

  it('reports when no active, consented face enrollment exists', async () => {
    vi.spyOn(faceEmbeddingService, 'extract').mockResolvedValue(Buffer.alloc(128 * 4, 1));
    vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([]) as never);

    await expect(
      new FaceVerificationService(configuration).findMatchingFaces(Buffer.from('camera frame'))
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('No active, consented face enrollment'),
      diagnosticCode: 'NO_ELIGIBLE_ENROLLMENT',
    });
  });

  it('fails closed when local verification is disabled', async () => {
    const extract = vi.spyOn(faceEmbeddingService, 'extract');
    const service = new FaceVerificationService({ enabled: false, encryptionKeyConfigured: false });
    await expect(service.findMatchingFaces(Buffer.from('image'))).rejects.toMatchObject({ statusCode: 503 });
    expect(extract).not.toHaveBeenCalled();
  });
});

describe('face verification account authentication', () => {
  it.each([
    ['patient', 'patient-profile-id'],
    ['doctor', 'doctor-profile-id'],
  ] as const)('authenticates the matched saved %s role and issues its normal session', async (role, linkedId) => {
    env.FACE_ENROLLMENT_ENABLED = true;
    const id = `${role}-account-id`;
    const user = {
      _id: { toString: () => id },
      username: `${role} user`,
      fullName: `${role} name`,
      email: `${role}@example.invalid`,
      role,
      status: 'active',
      doctorVerificationStatus: role === 'doctor' ? 'verified' : undefined,
      faceEnrollmentStatus: 'enrolled',
      faceConsentAt: new Date(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(faceVerificationService, 'findMatchingFaces').mockResolvedValue([{
      userId: id,
      similarity: 1,
    }]);
    const userQuery = mockFaceUsersQuery([user]);
    const findUsers = vi.spyOn(UserModel, 'find').mockReturnValue(userQuery as never);
    const ensureProfile = vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue(linkedId);
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const cookie = vi.fn();
    const response = { status, json, cookie } as unknown as Response;
    const next = vi.fn();

    await new AuthController().faceVerify(
      {
        file: { buffer: Buffer.from('camera image') },
        body: { consent: 'true' },
      } as Request,
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(findUsers).toHaveBeenCalledWith({
      _id: { $in: [id] },
      role: { $in: ['patient', 'doctor'] },
      status: 'active',
      faceEnrollmentStatus: 'enrolled',
      faceConsentAt: { $type: 'date' },
    });
    expect(ensureProfile).toHaveBeenCalledWith(user);
    expect(user.save).toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(200);
    expect(cookie).toHaveBeenCalledWith(
      'token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
    const responseBody = json.mock.calls[0][0];
    expect(responseBody).toMatchObject({
      verified: true,
      user: {
        id,
        role,
        ...(role === 'patient' ? { patientId: linkedId } : { doctorId: linkedId }),
      },
    });
    expect(JwtService.verifyToken(cookie.mock.calls[0][1])).toMatchObject({ userId: id, role, linkedId });
  });

  it('rejects an ambiguous match instead of authenticating either account', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    vi.spyOn(faceVerificationService, 'findMatchingFaces').mockResolvedValue([
      { userId: 'account-a', similarity: 0.9 },
      { userId: 'account-b', similarity: 0.8 },
    ]);
    vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([
      { _id: { toString: () => 'account-a' }, role: 'patient', status: 'active', faceEnrollmentStatus: 'enrolled', faceConsentAt: new Date() },
      { _id: { toString: () => 'account-b' }, role: 'doctor', status: 'active', faceEnrollmentStatus: 'enrolled', faceConsentAt: new Date() },
    ]) as never);
    const cookie = vi.fn();
    const next = vi.fn();

    await new AuthController().faceVerify(
      {
        file: { buffer: Buffer.from('camera image') },
        body: { consent: 'true' },
      } as Request,
      { cookie } as unknown as Response,
      next
    );

    expect(cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: expect.stringContaining('More than one enrolled account matched'),
    }));
  });

  it('rejects a match when the associated account is no longer enrolled', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    vi.spyOn(faceVerificationService, 'findMatchingFaces').mockResolvedValue([
      { userId: 'another-account-id', similarity: 1 },
    ]);
    vi.spyOn(UserModel, 'find').mockReturnValue(mockFaceUsersQuery([]) as never);
    const cookie = vi.fn();
    const next = vi.fn();

    await new AuthController().faceVerify(
      {
        file: { buffer: Buffer.from('camera image') },
        body: { consent: 'true' },
      } as Request,
      { cookie } as unknown as Response,
      next
    );

    expect(cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: expect.stringContaining('not linked to an active enrollment'),
    }));
  });

  it('returns a clear mismatch response when the matcher reports no matches', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    vi.spyOn(faceVerificationService, 'findMatchingFaces').mockResolvedValue([]);
    const findUsers = vi.spyOn(UserModel, 'find');
    const next = vi.fn();

    await new AuthController().faceVerify(
      {
        file: { buffer: Buffer.from('wrong face image') },
        body: { consent: 'true' },
      } as Request,
      {} as Response,
      next
    );

    expect(findUsers).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: expect.stringContaining('did not match an enrolled face'),
    }));
  });

  it('requires a camera image and respects the server feature setting', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    const next = vi.fn();
    await new AuthController().faceVerify(
      {} as Request,
      {} as Response,
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'A camera image is required for face sign-in.',
    }));

    env.FACE_ENROLLMENT_ENABLED = false;
    const disabledNext = vi.fn();
    await new AuthController().faceVerify(
      { file: { buffer: Buffer.from('camera image') } } as Request,
      {} as Response,
      disabledNext
    );
    expect(disabledNext).toHaveBeenCalledWith(expect.any(AppError));
    expect(disabledNext.mock.calls[0][0]).toMatchObject({ statusCode: 503 });
  });

  it('requires explicit consent before calling the biometric service', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    const verify = vi.spyOn(faceVerificationService, 'findMatchingFaces');
    const next = vi.fn();

    await new AuthController().faceVerify(
      { file: { buffer: Buffer.from('camera image') }, body: { consent: 'false' } } as Request,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'Consent is required before face sign-in.',
    }));
    expect(verify).not.toHaveBeenCalled();
  });
});
