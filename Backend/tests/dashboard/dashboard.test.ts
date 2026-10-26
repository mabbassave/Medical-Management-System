import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { DashboardController } from '../../src/presentation/controllers/Dashboard.controller';
import { PatientModel } from '../../src/infrastructure/database/schemas/Patient.schema';
import { DoctorModel } from '../../src/infrastructure/database/schemas/Doctor.schema';
import { AppointmentModel } from '../../src/infrastructure/database/schemas/Appointment.schema';
import { VitalsModel } from '../../src/infrastructure/database/schemas/Vitals.schema';

describe('DashboardController', () => {
  let controller: DashboardController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    controller = new DashboardController();
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should return aggregated counts efficiently using countDocuments', async () => {
    // Mock countDocuments for each schema
    vi.spyOn(PatientModel, 'countDocuments').mockReturnValue({
      exec: vi.fn().mockResolvedValue(120),
    } as any);

    vi.spyOn(DoctorModel, 'countDocuments').mockReturnValue({
      exec: vi.fn().mockResolvedValue(15),
    } as any);

    let appointmentCountCall = 0;
    vi.spyOn(AppointmentModel, 'countDocuments').mockImplementation(() => {
      appointmentCountCall++;
      return {
        exec: vi.fn().mockResolvedValue(appointmentCountCall === 1 ? 250 : 8),
      } as any;
    });

    vi.spyOn(VitalsModel, 'countDocuments').mockReturnValue({
      exec: vi.fn().mockResolvedValue(3),
    } as any);

    await controller.getStats(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        totalPatients: 120,
        totalDoctors: 15,
        totalAppointments: 250,
        appointmentsToday: 8,
        criticalVitalsCount: 3,
        data: {
          totalPatients: 120,
          totalDoctors: 15,
          totalAppointments: 250,
          appointmentsToday: 8,
          criticalVitalsCount: 3,
        },
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should forward errors to next middleware on database failure', async () => {
    const dbError = new Error('Database connection failed');
    vi.spyOn(PatientModel, 'countDocuments').mockReturnValue({
      exec: vi.fn().mockRejectedValue(dbError),
    } as any);

    await controller.getStats(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(dbError);
  });
});
