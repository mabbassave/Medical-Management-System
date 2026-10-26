import { Request, Response, NextFunction } from 'express';
import { MedicalRecordApplicationService } from '../../application/medical-record/MedicalRecordApplicationService';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError } from '../../domain/errors/AppError';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { DoctorModel } from '../../infrastructure/database/schemas/Doctor.schema';
import { PatientModel } from '../../infrastructure/database/schemas/Patient.schema';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';

export class MedicalRecordController {
  constructor(private readonly medicalRecordService: MedicalRecordApplicationService) {}

  public createRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { patientId, diagnosis, notes, allergies } = req.body;
      const persistedUser = user?.userId ? await UserModel.findById(user.userId) : null;
      if (!persistedUser || persistedUser.role !== 'doctor') {
        throw new AppError(403, 'Only a logged-in doctor can create a medical record');
      }
      const doctorId = await ensureUserProfile(persistedUser);
      if (!doctorId) throw new AppError(403, 'No doctor profile is linked to this account');

      const patientExists = await PatientModel.exists({ patientId });
      if (!patientExists) throw new AppError(404, 'Patient not found');

      const recordId = await this.medicalRecordService.createRecord({
        patientId,
        doctorId,
        diagnosis,
        notes,
        allergies: allergies || [],
      });

      res.status(201).json({
        success: true,
        message: 'Medical record created successfully',
        recordId,
      });
    } catch (error) {
      next(error);
    }
  };

  public getRecordsByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let patientId = String(req.params.patientId);
      const user = (req as AuthenticatedRequest).user;
      if (user?.role === 'patient') {
        const patientLinkedId = user.linkedId;
        if (!patientLinkedId || (patientId && patientId !== patientLinkedId)) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
        patientId = patientLinkedId;
        req.params.patientId = patientLinkedId;
      }

      const records = await this.medicalRecordService.getRecordsByPatient(patientId);
      const doctorIds = [...new Set(records.map((record) => record.doctorId))];
      const doctors = doctorIds.length > 0
        ? await DoctorModel.find({ doctorId: { $in: doctorIds } }).select('doctorId firstName lastName')
        : [];
      const doctorNames = new Map(doctors.map((doctor) => [
        doctor.doctorId,
        [doctor.firstName, doctor.lastName].filter(Boolean).join(' ') || 'Doctor',
      ]));

      const data = records.map((r) => ({
        recordId: r.recordId,
        patientId: r.patientId,
        doctorId: r.doctorId,
        doctorName: doctorNames.get(r.doctorId) || r.doctorId,
        diagnosis: r.diagnosis,
        notes: r.notes,
        allergies: r.allergies,
        createdAt: r.createdAt,
      }));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
