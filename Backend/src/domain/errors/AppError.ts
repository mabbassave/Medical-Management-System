/**
 * Custom application error class representing operational and business errors.
 * Encapsulates HTTP status code, descriptive message, and operational flag.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  /**
   * Overloaded constructor to support:
   *   new AppError(404, 'Doctor not found')
   *   new AppError('Doctor not found', 404)
   */
  constructor(statusCode: number, message: string, isOperational?: boolean);
  constructor(message: string, statusCode?: number, isOperational?: boolean);
  constructor(
    param1: number | string,
    param2?: string | number,
    isOperational: boolean = true
  ) {
    let statusCode = 500;
    let message = 'An unexpected error occurred';

    if (typeof param1 === 'number') {
      statusCode = param1;
      message = typeof param2 === 'string' ? param2 : message;
    } else {
      message = param1;
      statusCode = typeof param2 === 'number' ? param2 : 500;
    }

    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintain prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace if supported
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // --- Static Factory Methods ---
  public static badRequest(message: string = 'Bad request'): AppError {
    return new AppError(400, message);
  }

  public static validation(message: string = 'Validation failed'): AppError {
    return new AppError(400, message);
  }

  public static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(401, message);
  }

  public static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(403, message);
  }

  public static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(404, message);
  }

  public static conflict(message: string = 'Conflict'): AppError {
    return new AppError(409, message);
  }

  public static internal(message: string = 'Internal server error'): AppError {
    return new AppError(500, message, false);
  }
}

/**
 * Convenience error subclass for 404 Not Found errors.
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
  }
}

/**
 * Convenience error subclass for 401 Unauthorized errors.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

/**
 * Convenience error subclass for 403 Forbidden errors.
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
}

/**
 * Convenience error subclass for 409 Conflict errors.
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(409, message);
  }
}

/**
 * Convenience error subclass for 400 Validation / Bad Request errors.
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation error') {
    super(400, message);
  }
}
