import { describe, expect, it, vi, afterEach } from 'vitest';
import type { NextFunction, Response } from 'express';
import { Email } from '../../src/domain/patient/Email';
import { Patient } from '../../src/domain/patient/Patient.entity';
import { PatientId } from '../../src/domain/patient/PatientId';
import { PatientApplicationService } from '../../src/application/patient/PatientApplicationService';
import { PatientController } from '../../src/presentation/controllers/Patient.controller';
import { AuthenticatedRequest } from '../../src/presentation/middlewares/auth.middleware';

const makePatient = (patientId: string, firstName: string) =>
  new Patient({
    patientId: new PatientId(patientId),
    firstName,
    lastName: 'Patient',
    email: new Email(`${patientId}@example.com`),
    phone: '555-0100',
  });

describe('PatientController.getAllPatients', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns all database patients to a doctor before appointments are assigned', async () => {
    const assignedPatient = makePatient('assigned-1', 'Assigned');
    const otherPatient = makePatient('other-1', 'Other');
    const service = {
      getAllPatients: vi.fn().mockResolvedValue([assignedPatient, otherPatient]),
    } as unknown as PatientApplicationService;
    const responseBody = vi.fn();
    const responseStatus = vi.fn().mockReturnValue({ json: responseBody });
    const next = vi.fn() as NextFunction;
    const controller = new PatientController(service);

    await controller.getAllPatients(
      {
        user: { userId: 'doctor-user', role: 'doctor', linkedId: 'doctor-profile' },
      } as AuthenticatedRequest,
      { status: responseStatus } as unknown as Response,
      next
    );

    expect(responseStatus).toHaveBeenCalledWith(200);
    expect(responseBody).toHaveBeenCalledWith({
      success: true,
      data: [
        expect.objectContaining({
          patientId: 'assigned-1',
          firstName: 'Assigned',
        }),
        expect.objectContaining({
          patientId: 'other-1',
          firstName: 'Other',
        }),
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });
});
