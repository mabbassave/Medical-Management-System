import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { DoctorController } from '../../src/presentation/controllers/Doctor.controller';
import { DoctorApplicationService } from '../../src/application/doctor/DoctorApplicationService';
import { DoctorModel } from '../../src/infrastructure/database/schemas/Doctor.schema';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';
import { Doctor } from '../../src/domain/doctor/Doctor.entity';
import { DoctorId } from '../../src/domain/doctor/DoctorId';
import { Email } from '../../src/domain/patient/Email';

describe('DoctorController.getAllDoctors', () => {
  afterEach(() => vi.restoreAllMocks());

  it('includes linked license details for administrators without verification data', async () => {
    const doctor = new Doctor({
      doctorId: new DoctorId('doctor-profile-id'),
      firstName: 'Ava',
      lastName: 'Doctor',
      email: new Email('ava@example.com'),
      specialization: 'Cardiology',
    });
    const service = {
      getAllDoctors: vi.fn().mockResolvedValue([doctor]),
    } as unknown as DoctorApplicationService;
    const profileQuery = {
      select: vi.fn().mockResolvedValue([{
        doctorId: 'doctor-profile-id',
        userId: 'doctor-user-id',
      }]),
    };
    vi.spyOn(DoctorModel, 'find').mockReturnValue(profileQuery as never);
    const userQuery = {
      select: vi.fn().mockResolvedValue([{
        _id: 'doctor-user-id',
        email: 'legacy-account@example.com',
        licenseNumber: 'LIC-12345',
      }]),
    };
    vi.spyOn(UserModel, 'find').mockReturnValue(userQuery as never);
    const responseJson = vi.fn();
    const responseStatus = vi.fn().mockReturnValue({ json: responseJson });
    const controller = new DoctorController(service);

    await controller.getAllDoctors(
      { user: { userId: 'admin-user', role: 'admin' } } as never,
      { status: responseStatus } as unknown as Response,
      vi.fn() as NextFunction
    );

    expect(UserModel.find).toHaveBeenCalledWith({
      role: 'doctor',
      $or: [
        { _id: { $in: ['doctor-user-id'] } },
        { linkedId: { $in: ['doctor-profile-id'] } },
        { email: { $in: ['ava@example.com'] } },
      ],
    });
    expect(profileQuery.select).toHaveBeenCalledWith('doctorId userId');
    expect(userQuery.select).toHaveBeenCalledWith('_id linkedId email licenseNumber');
    expect(responseJson).toHaveBeenCalledWith({
      success: true,
      data: [expect.objectContaining({
        doctorId: 'doctor-profile-id',
        licenseNumber: 'LIC-12345',
      })],
    });
  });
});
