import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AppError } from '../../domain/errors/AppError';
import { env } from '../config/env';

const VERSION = 1;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

const encryptionKey = (): Buffer => {
  const encoded = env.BIOMETRIC_ENCRYPTION_KEY;
  if (!encoded) {
    throw new AppError(503, 'Biometric encryption is not configured. Use email and password sign-in.');
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new AppError(503, 'Biometric encryption key is invalid. Contact support.');
  }
  return key;
};

export class FaceTemplateCrypto {
  public encrypt(template: Buffer, accountId: string): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    cipher.setAAD(Buffer.from(accountId, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(template), cipher.final()]);
    return Buffer.concat([
      Buffer.from([VERSION]),
      iv,
      cipher.getAuthTag(),
      ciphertext,
    ]);
  }

  public decrypt(encryptedTemplate: Buffer, accountId: string): Buffer {
    if (encryptedTemplate.length <= 1 + IV_BYTES + AUTH_TAG_BYTES || encryptedTemplate[0] !== VERSION) {
      throw new AppError(503, 'The stored face template cannot be read. Re-enroll using email and password.');
    }

    const ivStart = 1;
    const tagStart = ivStart + IV_BYTES;
    const ciphertextStart = tagStart + AUTH_TAG_BYTES;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      encryptedTemplate.subarray(ivStart, tagStart)
    );
    decipher.setAAD(Buffer.from(accountId, 'utf8'));
    decipher.setAuthTag(encryptedTemplate.subarray(tagStart, ciphertextStart));

    try {
      return Buffer.concat([
        decipher.update(encryptedTemplate.subarray(ciphertextStart)),
        decipher.final(),
      ]);
    } catch {
      throw new AppError(503, 'The stored face template cannot be read. Re-enroll using email and password.');
    }
  }
}

export const faceTemplateCrypto = new FaceTemplateCrypto();