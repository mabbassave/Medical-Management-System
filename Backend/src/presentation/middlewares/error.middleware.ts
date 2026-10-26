import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { env } from '../../infrastructure/config/env';
import { AppError } from '../../domain/errors/AppError';
import { FaceVerificationError } from '../../domain/errors/FaceVerificationError';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode =
    typeof err?.statusCode === 'number'
      ? err.statusCode
      : typeof err?.status === 'number'
      ? err.status
      : 500;
  const errorName = err instanceof Error ? err.name : 'UnknownError';
  console.error('[HTTP] Request failed', { statusCode, errorName });

  // Multer errors (wrong file type, size exceeded, unexpected field, etc.)
  // arrive here via next(err) from multer middleware – return 400 with the
  // real message so the client knows exactly what went wrong.
  if (err instanceof MulterError) {
    res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
    return;
  }

  // Custom errors thrown with a message (e.g. unsupported mime type)
  if (err?.message === 'Only PDF, JPG, JPEG, and PNG files are allowed') {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Handle custom AppError (business and operational errors: not found, unauthorized, validation, conflict)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(env.isDevelopment && err instanceof FaceVerificationError
        ? { diagnosticCode: err.diagnosticCode }
        : {}),
    });
    return;
  }

  // Handle errors that have a numeric statusCode or status property
  // Preserve actionable client errors without exposing internal 5xx exception details.
  const is4xx = statusCode >= 400 && statusCode < 500;
  const message: string =
    is4xx
      ? err?.message || 'Something went wrong'
      : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
  });
};
