import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { AppointmentModel } from '../../infrastructure/database/schemas/Appointment.schema';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';

const createRequireRole = (roles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.role) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userRole = req.user.role.toLowerCase();
    const normalizedAllowedRoles = roles.map((r) => r.toLowerCase());

    if (userRole === 'admin') {
      next();
      return;
    }

    if (!normalizedAllowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions to access this resource',
      });
      return;
    }

    next();
  };
};

/**
 * Role-based authorization middleware.
 * Runs after authMiddleware.
 * Validates req.user.role against the allowed roles.
 * Returns 403 Forbidden if the role is not allowed.
 */
export const requireRole = (...roles: string[]) => createRequireRole(roles);

/**
 * Ensures patients can only access their own records and doctors only access assigned patients.
 * Runs after authMiddleware.
 * - Admins and nurses retain their existing staff access.
 * - Doctors must have an appointment relationship with the requested patient.
 * - If user is patient:
 *     1. Validates that patient is accessing their own data.
 *     2. Returns 403 Forbidden if patient tries to access another patient's data.
 *     3. Forces patientId parameter from the authenticated user token.
 */
interface PatientAccessOptions {
  allowUnassignedDoctorRead?: boolean;
}

export const requirePatientSelfOrRole = (
  paramName: string = 'patientId',
  ...accessRules: Array<string | PatientAccessOptions>
) => {
  const options = accessRules.find((rule): rule is PatientAccessOptions => typeof rule === 'object') || {};
  const allowedStaffRoles = accessRules.filter((rule): rule is string => typeof rule === 'string');
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.role) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const userRole = req.user.role.toLowerCase();
      const staffRoles = (
        allowedStaffRoles.length > 0 ? allowedStaffRoles : ['admin', 'doctor', 'nurse']
      ).map((r) => r.toLowerCase());

      if (userRole === 'admin') {
        next();
        return;
      }

      if (staffRoles.includes(userRole)) {
        if (userRole === 'doctor' && !options.allowUnassignedDoctorRead) {
          const targetPatientId =
            req.params[paramName] ||
            req.body?.[paramName] ||
            (req.query?.[paramName] as string | undefined);
          if (targetPatientId) {
            const persistedUser = req.user.userId ? await UserModel.findById(req.user.userId) : null;
            const doctorId = persistedUser?.role === 'doctor'
              ? await ensureUserProfile(persistedUser)
              : undefined;
            if (doctorId) req.user.linkedId = doctorId;
            if (
              !doctorId ||
              !(await AppointmentModel.exists({
                doctorId,
                patientId: String(targetPatientId),
              }))
            ) {
              res.status(403).json({
                success: false,
                message: 'You can only access records for your assigned patients',
              });
              return;
            }
          }
        }
        next();
        return;
      }

      // Patients must only access their own records
      if (userRole === 'patient') {
        let patientLinkedId = req.user.linkedId;

        // Resolve the canonical profile by the authenticated Mongo user ID. A stale JWT
        // linkedId must not hide the patient's own records or point at another profile.
        if (req.user.userId) {
          const persistedUser = await UserModel.findById(req.user.userId);
          if (!persistedUser || persistedUser.role !== 'patient') {
            res.status(403).json({
              success: false,
              message: 'Forbidden: No patient profile linked to this account',
            });
            return;
          }
          patientLinkedId = await ensureUserProfile(persistedUser);
        }

        if (!patientLinkedId) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: No patient profile linked to this account',
          });
          return;
        }

        const targetPatientId = req.params[paramName] || req.body?.[paramName] || (req.query?.[paramName] as string | undefined);

        // Return 403 Forbidden if patient attempts to access another patient's records
        if (targetPatientId && String(targetPatientId) !== String(patientLinkedId)) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: Patients can only access their own data',
          });
          return;
        }

        // Force patientId parameter from the authenticated user token
        req.params[paramName] = patientLinkedId;
        if (req.body && typeof req.body === 'object') {
          req.body[paramName] = patientLinkedId;
        }
        req.user.linkedId = patientLinkedId;

        next();
        return;
      }

      res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions to access this resource',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Authorization error',
      });
    }
  };
};
