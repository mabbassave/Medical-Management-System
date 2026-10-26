import { Request, Response, NextFunction } from 'express';
import { JwtService, JwtPayload } from '../../infrastructure/auth/JwtService';
import { TokenBlacklistService } from '../../infrastructure/auth/TokenBlacklistService';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  faceEnrollmentTicket?: boolean;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice('Bearer '.length)
        : undefined);

    if (!token) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Check if token is blacklisted in Redis
    const isBlacklisted = await TokenBlacklistService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({ success: false, message: 'Token is invalid' });
      return;
    }

    // Verify token
    try {
      const decoded = JwtService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

export const faceEnrollmentAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sessionToken =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length)
      : undefined);

  if (sessionToken) {
    const isBlacklisted = await TokenBlacklistService.isTokenBlacklisted(sessionToken);
    if (isBlacklisted) {
      res.status(401).json({ success: false, message: 'Token is invalid' });
      return;
    }
    try {
      req.user = JwtService.verifyToken(sessionToken);
      next();
    } catch {
      res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return;
  }

  const ticket = req.cookies?.face_enrollment;
  if (!ticket) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    req.user = JwtService.verifyFaceEnrollmentToken(ticket);
    req.faceEnrollmentTicket = true;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Face enrollment session expired. Please sign in again.' });
  }
};

export { requireRole, requirePatientSelfOrRole } from './role.middleware';
