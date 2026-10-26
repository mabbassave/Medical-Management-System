import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  role: string;
  linkedId?: string;
  scope?: string;
}

export class JwtService {
  private static getSecret(): string {
    return env.JWT_SECRET;
  }

  public static generateToken(userId: string, role: string, linkedId?: string): string {
    const payload: JwtPayload = { userId, role, ...(linkedId ? { linkedId } : {}) };
    return jwt.sign(payload, this.getSecret(), { expiresIn: '1d' });
  }

  public static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.getSecret()) as JwtPayload;
  }

  public static generateFaceEnrollmentToken(userId: string, role: string): string {
    return jwt.sign(
      { userId, role, scope: 'face_enrollment' },
      this.getSecret(),
      { expiresIn: '20m', jwtid: randomUUID() }
    );
  }

  public static verifyFaceEnrollmentToken(token: string): JwtPayload {
    const payload = jwt.verify(token, this.getSecret()) as JwtPayload;
    if (payload.scope !== 'face_enrollment' || !payload.userId || !['patient', 'doctor'].includes(payload.role)) {
      throw new Error('Invalid face enrollment ticket');
    }
    return payload;
  }
}
