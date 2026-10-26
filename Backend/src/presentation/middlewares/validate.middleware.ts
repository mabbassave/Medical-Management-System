import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Invalid request data',
      });
    }
  };
};
