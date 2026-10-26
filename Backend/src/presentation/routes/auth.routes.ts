import { Router } from 'express';
import multer from 'multer';
import { AuthController } from '../controllers/Auth.controller';
import { OAuthController } from '../controllers/OAuth.controller';
import { authMiddleware, faceEnrollmentAuthMiddleware } from '../middlewares/auth.middleware';
import {
  faceEnrollmentRateLimiter,
  ensureFaceVerificationConfigured,
  faceVerificationIpRateLimiter,
  faceVerificationRateLimiter,
  loginRateLimiter,
  oauthRateLimiter,
  passwordResetRateLimiter,
  registerRateLimiter,
  ensureFaceVerificationClientIdentity,
  validateFaceVerificationInput,
} from '../middlewares/rateLimit.middleware';
import { AppError } from '../../domain/errors/AppError';
import { validate } from '../middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from '../schemas';

const authRouter = Router();
const authController = new AuthController();
const oauthController = new OAuthController();
const faceImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      callback(new AppError(400, 'Only JPEG and PNG camera images are accepted.'));
      return;
    }
    callback(null, true);
  },
});

// Registration endpoint
authRouter.post('/register', registerRateLimiter, validate(registerSchema), authController.register);

// Strict rate limit: 5 attempts per 15 minutes per IP
authRouter.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
authRouter.post(
  '/face-verify',
  faceImageUpload.single('image'),
  validateFaceVerificationInput,
  ensureFaceVerificationConfigured,
  ensureFaceVerificationClientIdentity,
  faceVerificationIpRateLimiter,
  faceVerificationRateLimiter,
  authController.faceVerify
);
authRouter.post(
  '/face-enroll',
  faceEnrollmentAuthMiddleware,
  faceEnrollmentRateLimiter,
  faceImageUpload.single('image'),
  authController.enrollFace
);
authRouter.delete(
  '/face-enroll',
  authMiddleware,
  faceEnrollmentRateLimiter,
  authController.deleteFaceEnrollment
);
authRouter.post('/logout', authController.logout);
authRouter.get('/session', authMiddleware, authController.providerSession);

authRouter.get('/providers', oauthController.getProviders);
authRouter.get('/google', oauthRateLimiter, oauthController.start('google'));
authRouter.get('/google/callback', oauthController.callback('google'));
authRouter.get('/apple', oauthRateLimiter, oauthController.start('apple'));
authRouter.get('/apple/callback', oauthController.callback('apple'));
authRouter.post('/apple/callback', oauthController.callback('apple'));


// Strict rate limit: 5 attempts per 15 minutes per IP for OTP and password recovery
authRouter.post('/forgot-password', passwordResetRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/verify-reset-otp', passwordResetRateLimiter, validate(verifyResetOtpSchema), authController.verifyResetOtp);
authRouter.post('/reset-password', passwordResetRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

export default authRouter;
