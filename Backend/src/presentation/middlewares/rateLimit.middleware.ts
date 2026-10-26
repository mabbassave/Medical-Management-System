import rateLimit, { type RateLimitInfo } from 'express-rate-limit';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../domain/errors/AppError';
import { env } from '../../infrastructure/config/env';
import { isFaceEnrollmentConfigured } from '../../infrastructure/biometrics/FaceEnrollmentService';
import { faceEmbeddingService } from '../../infrastructure/biometrics/FaceEmbeddingService';

/**
 * Rate limiter for login endpoint.
 * Strict limit: 5 attempts per 15 minutes per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  standardHeaders: true, // Return standard `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  statusCode: 429,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts from this IP address. Please try again after 15 minutes.',
    });
  },
});

/**
 * Rate limiter for OTP generation, password reset requests, and verification.
 * Strict limit: 5 attempts per 15 minutes per IP.
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many password reset / OTP attempts from this IP address. Please try again after 15 minutes.',
    });
  },
});

/**
 * Optional registration limiter: 10 registrations per hour per IP
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many account registrations from this IP address. Please try again after an hour.',
    });
  },
});

export const faceEnrollmentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many face enrollment attempts. Please wait before trying again.',
    });
  },
});

const faceVerificationWindowMs = 15 * 60 * 1000;

export const validateFaceVerificationInput = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.file?.buffer?.length) {
    next(new AppError(400, 'A camera image is required for face sign-in.'));
    return;
  }
  if (req.body?.consent !== 'true') {
    next(new AppError(400, 'Consent is required before face sign-in.'));
    return;
  }
  next();
};

export const ensureFaceVerificationConfigured = async (
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!isFaceEnrollmentConfigured()) {
    next(new AppError(503, 'Local face verification is disabled or its encryption key is missing. Use email and password sign-in.'));
    return;
  }
  try {
    await faceEmbeddingService.ensureReady();
    next();
  } catch (error) {
    next(error);
  }
};

export const createFaceVerificationRateLimiter = (
  max = 5,
  windowMs = faceVerificationWindowMs,
  keyGenerator?: (req: Request, res: Response) => string
) => rateLimit({
  windowMs,
  max,
  ...(keyGenerator ? { keyGenerator } : {}),
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (req: Request & { rateLimit?: RateLimitInfo }, res: Response) => {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        ((req.rateLimit?.resetTime?.getTime() ?? Date.now() + windowMs) - Date.now()) / 1000
      )
    );
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({
      success: false,
      message: `Too many face sign-in attempts. Please retry in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    });
  },
});

const faceAttemptCookieName = 'face_verify_attempt';

const signFaceAttemptId = (id: string) =>
  createHmac('sha256', env.JWT_SECRET).update(id).digest('hex');

export const ensureFaceVerificationClientIdentity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.[faceAttemptCookieName];
  const [id, signature] = typeof token === 'string' ? token.split('.') : [];
  const validId = typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);
  const expectedSignature = validId ? signFaceAttemptId(id) : '';
  const validSignature =
    validId &&
    typeof signature === 'string' &&
    /^[a-f0-9]{64}$/i.test(signature) &&
    timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));

  if (!validId || !validSignature) {
    const newId = randomUUID();
    res.cookie(faceAttemptCookieName, `${newId}.${signFaceAttemptId(newId)}`, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: faceVerificationWindowMs,
      path: '/api/auth/face-verify',
    });
    req.cookies = {
      ...req.cookies,
      [faceAttemptCookieName]: `${newId}.${signFaceAttemptId(newId)}`,
    };
  }
  next();
};

// A signed browser bucket avoids exhausting one small IP limit for everyone behind a NAT.
export const faceVerificationIpRateLimiter = createFaceVerificationRateLimiter(20);
export const faceVerificationRateLimiter = createFaceVerificationRateLimiter(
  5,
  faceVerificationWindowMs,
  (req) => `face-browser:${req.cookies?.[faceAttemptCookieName]?.split('.')[0] ?? 'missing'}`
);

export const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many sign-in attempts. Please wait and try again.',
    });
  },
});

/**
 * Relaxed general rate limiter for general/clinical API usage
 * Ensures regular doctors, nurses, and clinical operations are not aggressively blocked.
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Generous limit for normal clinical workflows
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Please slow down and try again shortly.',
    });
  },
});
