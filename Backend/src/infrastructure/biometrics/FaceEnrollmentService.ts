import { AppError } from '../../domain/errors/AppError';
import { env } from '../config/env';
import { faceEmbeddingService } from './FaceEmbeddingService';
import { faceTemplateCrypto } from './FaceTemplateCrypto';

export interface FaceEnrollmentConfiguration {
  enabled: boolean;
  encryptionKeyConfigured: boolean;
}

export const getFaceEnrollmentConfiguration = (): FaceEnrollmentConfiguration => ({
  enabled: env.FACE_ENROLLMENT_ENABLED,
  encryptionKeyConfigured: Boolean(env.BIOMETRIC_ENCRYPTION_KEY),
});

export const isFaceEnrollmentConfigured = (configuration = getFaceEnrollmentConfiguration()) =>
  configuration.enabled && configuration.encryptionKeyConfigured;

export class FaceEnrollmentService {
  constructor(private readonly configuration?: FaceEnrollmentConfiguration) {}

  private assertConfigured(): void {
    if (!isFaceEnrollmentConfigured(this.configuration)) {
      throw new AppError(
        503,
        'Local face enrollment is not configured. Please use email and password sign-in.'
      );
    }
  }

  public async enrollFace(_userId: string, image: Buffer): Promise<Buffer> {
    this.assertConfigured();
    return faceTemplateCrypto.encrypt(await faceEmbeddingService.extract(image), _userId);
  }
}

export const faceEnrollmentService = new FaceEnrollmentService();
