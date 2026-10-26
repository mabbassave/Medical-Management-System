import { Request, Response, NextFunction } from 'express';
import { LabReportModel } from '../../infrastructure/database/schemas/LabReport.schema';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { PatientModel } from '../../infrastructure/database/schemas/Patient.schema';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';
import { AppError } from '../../domain/errors/AppError';

export class LabReportController {
  public createReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const user = userId ? await UserModel.findById(userId) : null;
      if (!user || !['admin', 'doctor', 'nurse'].includes(user.role)) {
        throw new AppError(403, 'Only authorized staff can create lab reports.');
      }

      const { patientId } = req.params;

      if (!patientId) {
        throw new AppError(400, 'patientId is required in the URL parameters');
      }

      const patientExists = await PatientModel.exists({ patientId });
      if (!patientExists) throw new AppError(404, 'Patient not found');

      // Attribution comes only from the authenticated account. Never trust a
      // doctorId supplied by the client.
      const doctorId = user.role === 'doctor' ? await ensureUserProfile(user) : undefined;
      if (user.role === 'doctor' && !doctorId) {
        throw new AppError(403, 'No doctor profile is linked to this account');
      }

      const testName = typeof req.body.testName === 'string' ? req.body.testName.trim() : '';
      const result = typeof req.body.result === 'string' ? req.body.result.trim() : '';
      if (!testName || !result) {
        throw new AppError(400, 'Test name and result are required.');
      }

      const labReport = new LabReportModel({
        patientId,
        ...(doctorId ? { doctorId } : {}),
        testName,
        result,
        uploadedAt: new Date(),
      });

      const savedReport = await labReport.save();

      res.status(201).json({
        success: true,
        message: 'Lab report created successfully',
        report: savedReport,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Fetch all lab reports for a specific patient
   */
  public getReportsByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;

      if (!patientId) {
        throw new AppError(400, 'patientId is required in the URL parameters');
      }

      const userId = (req as AuthenticatedRequest).user?.userId;
      const user = userId ? await UserModel.findById(userId) : null;
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      let targetPatientId = patientId;
      if (user.role === 'patient') {
        if (!user.linkedId || (targetPatientId && user.linkedId !== targetPatientId)) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
        targetPatientId = user.linkedId;
        req.params.patientId = user.linkedId;
      }
      if (!['admin', 'doctor', 'nurse', 'patient'].includes(user.role)) {
        throw new AppError(403, 'Forbidden');
      }

      console.log('[LabReport] Fetching patient reports.');
      const reports = await LabReportModel.find({ patientId: targetPatientId }).sort({ uploadedAt: -1 });

      res.status(200).json({
        success: true,
        reports,
      });
    } catch (error) {
      next(error);
    }
  };
}
