import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { requirePatientSelfOrRole, requireRole } from '../../src/presentation/middlewares/role.middleware';
import { AuthenticatedRequest } from '../../src/presentation/middlewares/auth.middleware';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';
import { AppointmentModel } from '../../src/infrastructure/database/schemas/Appointment.schema';
import * as ProfileLinker from '../../src/infrastructure/database/UserProfileLinker';

describe('Role & Patient Access Control Middleware', () => {
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('requirePatientSelfOrRole', () => {
    it('should allow admins and nurses to access any patient data', async () => {
      const middleware = requirePatientSelfOrRole('patientId', 'doctor', 'nurse');

      const staffRoles = ['admin', 'nurse'];
      for (const role of staffRoles) {
        mockNext.mockClear();
        const req: Partial<AuthenticatedRequest> = {
          user: { userId: 'staff-1', role },
          params: { patientId: 'patient-999' },
        };

        await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      }
    });

    it('allows doctors to access their assigned patients regardless of legacy verification status', async () => {
      const findById = vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          role: 'doctor',
          doctorVerificationStatus: 'pending',
        }),
        then: (resolve: (value: unknown) => unknown) => resolve({ role: 'doctor' }),
      } as never);
      const ensureProfile = vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('doctor-profile-current');
      const appointmentExists = vi.spyOn(AppointmentModel, 'exists').mockResolvedValue({ _id: 'appointment-1' } as never);
      const middleware = requirePatientSelfOrRole('patientId', 'doctor', 'nurse');

      try {
        await middleware(
          {
            user: { userId: 'doctor-1', role: 'doctor', linkedId: 'doctor-profile-stale' },
            params: { patientId: 'patient-1' },
          } as AuthenticatedRequest,
          mockRes as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalled();
        expect(appointmentExists).toHaveBeenCalledWith({
          doctorId: 'doctor-profile-current',
          patientId: 'patient-1',
        });
      } finally {
        findById.mockRestore();
        ensureProfile.mockRestore();
        appointmentExists.mockRestore();
      }
    });

    it('blocks doctors from accessing patients without an appointment relationship', async () => {
      const findById = vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          role: 'doctor',
          doctorVerificationStatus: 'verified',
        }),
        then: (resolve: (value: unknown) => unknown) => resolve({ role: 'doctor' }),
      } as never);
      const ensureProfile = vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('doctor-profile-current');
      const appointmentExists = vi.spyOn(AppointmentModel, 'exists').mockResolvedValue(null);
      const middleware = requirePatientSelfOrRole('patientId', 'doctor', 'nurse');

      try {
        await middleware(
          {
            user: { userId: 'doctor-1', role: 'doctor', linkedId: 'doctor-profile-1' },
            params: { patientId: 'unassigned-patient' },
          } as AuthenticatedRequest,
          mockRes as Response,
          mockNext
        );

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
      } finally {
        findById.mockRestore();
        ensureProfile.mockRestore();
        appointmentExists.mockRestore();
      }
    });

    it('allows doctor reads across the development patient roster only when explicitly enabled', async () => {
      const findById = vi.spyOn(UserModel, 'findById');
      const appointmentExists = vi.spyOn(AppointmentModel, 'exists');
      const middleware = requirePatientSelfOrRole(
        'patientId',
        'doctor',
        'nurse',
        { allowUnassignedDoctorRead: true }
      );

      await middleware(
        {
          user: { userId: 'doctor-1', role: 'doctor', linkedId: 'doctor-profile-1' },
          params: { patientId: 'existing-patient-without-appointment' },
        } as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(findById).not.toHaveBeenCalled();
      expect(appointmentExists).not.toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('still restricts a patient to their own ID when development doctor reads are enabled', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient' } as never);
      vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('patient-123');
      const middleware = requirePatientSelfOrRole(
        'patientId',
        'doctor',
        'nurse',
        { allowUnassignedDoctorRead: true }
      );

      await middleware(
        {
          user: { userId: 'patient-user', role: 'patient', linkedId: 'patient-123' },
          params: { patientId: 'other-patient' },
        } as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow patient to access their own records and force patientId from token', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient' } as never);
      vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('patient-123');
      const middleware = requirePatientSelfOrRole('patientId');
      const req: Partial<AuthenticatedRequest> = {
        user: { userId: 'user-1', role: 'patient', linkedId: 'patient-123' },
        params: { patientId: 'patient-123' },
      };

      await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.params!.patientId).toBe('patient-123');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when a patient tries to access another patient data', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient' } as never);
      vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('patient-123');
      const middleware = requirePatientSelfOrRole('patientId');
      const req: Partial<AuthenticatedRequest> = {
        user: { userId: 'user-1', role: 'patient', linkedId: 'patient-123' },
        params: { patientId: 'other-patient-456' },
      };

      await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: Patients can only access their own data',
      });
    });

    it('should force patientId from token when URL params is empty or missing for a patient', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient' } as never);
      vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('patient-123');
      const middleware = requirePatientSelfOrRole('patientId');
      const req: Partial<AuthenticatedRequest> = {
        user: { userId: 'user-1', role: 'patient', linkedId: 'patient-123' },
        params: {},
      };

      await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.params!.patientId).toBe('patient-123');
    });

    it('uses the canonical patient UUID when the session token contains a stale linkedId', async () => {
      vi.spyOn(UserModel, 'findById').mockResolvedValue({ role: 'patient' } as never);
      vi.spyOn(ProfileLinker, 'ensureUserProfile').mockResolvedValue('current-patient-uuid');
      const middleware = requirePatientSelfOrRole('patientId');
      const req: Partial<AuthenticatedRequest> = {
        user: { userId: 'user-1', role: 'patient', linkedId: 'stale-patient-id' },
        params: { patientId: 'current-patient-uuid' },
      };

      await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user?.linkedId).toBe('current-patient-uuid');
      expect(req.params?.patientId).toBe('current-patient-uuid');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when request is not authenticated', async () => {
      const middleware = requirePatientSelfOrRole('patientId');
      const req: Partial<AuthenticatedRequest> = {
        params: { patientId: 'patient-123' },
      };

      await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized',
      });
    });
  });

  describe('requireRole', () => {
    it('should allow an approved user with a matching doctor role', async () => {
      const middleware = requireRole('admin', 'doctor');
      const req: Partial<AuthenticatedRequest> = {
        user: { userId: 'u1', role: 'doctor' },
      };
      const findById = vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          role: 'doctor',
          doctorVerificationStatus: 'verified',
        }),
      } as never);
      const appointmentExists = vi.spyOn(AppointmentModel, 'exists').mockResolvedValue(null);

      try {
        await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      } finally {
        findById.mockRestore();
        appointmentExists.mockRestore();
      }
    });

    it('allows doctors through role checks regardless of legacy verification status', async () => {
      const middleware = requireRole('admin', 'doctor');
      const req: Partial<AuthenticatedRequest> = {
        user: { userId: 'u1', role: 'doctor' },
      };

      await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not authorized', async () => {
      const middleware = requireRole('admin');
      const req: Partial<AuthenticatedRequest> = {
        user: { userId: 'u1', role: 'patient' },
      };

      await middleware(req as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
