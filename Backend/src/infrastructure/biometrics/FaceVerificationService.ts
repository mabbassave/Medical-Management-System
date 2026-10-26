import { AppError } from '../../domain/errors/AppError';
import { FaceVerificationError } from '../../domain/errors/FaceVerificationError';
import { UserModel } from '../database/schemas/User.schema';
import type { FaceEnrollmentConfiguration } from './FaceEnrollmentService';
import { isFaceEnrollmentConfigured } from './FaceEnrollmentService';
import { faceEmbeddingService } from './FaceEmbeddingService';
import { faceTemplateCrypto } from './FaceTemplateCrypto';

export interface FaceVerificationMatch {
  userId: string;
  similarity: number;
}

const SIMILARITY_THRESHOLD = 0.363;

const cosineSimilarity = (left: Buffer, right: Buffer): number | undefined => {
  if (!left.length || left.length !== right.length || left.length % 4 !== 0) return undefined;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let offset = 0; offset < left.length; offset += 4) {
    const leftValue = left.readFloatLE(offset);
    const rightValue = right.readFloatLE(offset);
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return undefined;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) return undefined;
  return dot / Math.sqrt(leftNorm * rightNorm);
};

export class FaceVerificationService {
  constructor(
    private readonly configuration?: FaceEnrollmentConfiguration
  ) {}

  public async findMatchingFaces(image: Buffer): Promise<FaceVerificationMatch[]> {
    if (!isFaceEnrollmentConfigured(this.configuration)) {
      throw new AppError(
        503,
        'Local face verification is not configured. Please sign in with your email and password.'
      );
    }

    const candidate = await faceEmbeddingService.extract(image);
    const users = await UserModel.find({
      role: { $in: ['patient', 'doctor'] },
      status: 'active',
      faceEnrollmentStatus: 'enrolled',
      faceConsentAt: { $type: 'date' },
    }).select('+faceTemplateEncrypted');

    const matches: FaceVerificationMatch[] = [];
    let templatePresentCount = 0;
    let unreadableTemplateCount = 0;
    let dimensionMismatchCount = 0;
    let comparableTemplateCount = 0;
    for (const user of users) {
      if (!Buffer.isBuffer(user.faceTemplateEncrypted)) {
        continue;
      }
      templatePresentCount += 1;
      try {
        const storedTemplate = faceTemplateCrypto.decrypt(user.faceTemplateEncrypted, user._id.toString());
        if (storedTemplate.length !== candidate.length || storedTemplate.length % 4 !== 0) {
          dimensionMismatchCount += 1;
          continue;
        }
        comparableTemplateCount += 1;
        const similarity = cosineSimilarity(candidate, storedTemplate);
        if (similarity !== undefined && similarity >= SIMILARITY_THRESHOLD) {
          matches.push({ userId: user._id.toString(), similarity });
        }
      } catch (error) {
        if (error instanceof AppError) {
          unreadableTemplateCount += 1;
          continue;
        }
        throw error;
      }
    }

    if (users.length === 0) {
      throw new FaceVerificationError(
        409,
        'No active, consented face enrollment is available. Sign in with your password to enroll your face.',
        'NO_ELIGIBLE_ENROLLMENT'
      );
    }
    if (comparableTemplateCount === 0) {
      if (templatePresentCount === 0) {
        throw new FaceVerificationError(
          409,
          'Your face enrollment has no saved template. Sign in with your password and enroll your face again.',
          'FACE_TEMPLATE_MISSING'
        );
      }
      throw new FaceVerificationError(
        503,
        dimensionMismatchCount > 0 && unreadableTemplateCount === 0
          ? 'Saved face enrollment data is incompatible with the current face model. Sign in with your password and re-enroll your face.'
          : 'Saved face enrollment data could not be decrypted. Sign in with your password and re-enroll your face.',
        dimensionMismatchCount > 0 && unreadableTemplateCount === 0
          ? 'FACE_TEMPLATE_INCOMPATIBLE'
          : 'FACE_TEMPLATE_UNREADABLE'
      );
    }
    if (matches.length === 0) {
      throw new FaceVerificationError(
        401,
        'This camera image did not match an enrolled face. Try again with your enrolled face or sign in with your password.',
        'FACE_MISMATCH'
      );
    }

    return matches.sort((left, right) => right.similarity - left.similarity);
  }
}

export const faceVerificationService = new FaceVerificationService();
