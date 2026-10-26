import { Request, Response, NextFunction } from 'express';
import { PrescriptionApplicationService } from '../../application/prescription/PrescriptionApplicationService';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError } from '../../domain/errors/AppError';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';
import { DoctorModel } from '../../infrastructure/database/schemas/Doctor.schema';
import { PatientModel } from '../../infrastructure/database/schemas/Patient.schema';

export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionApplicationService) {}

  public createPrescription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { patientId, doctorId, medicines, diagnosis } = req.body;
      if (user?.role === 'doctor' && (!user.linkedId || user.linkedId !== doctorId)) {
        throw new AppError(403, 'Doctors can only create prescriptions under their own profile');
      }

      const prescriptionId = await this.prescriptionService.createPrescription({
        patientId,
        doctorId,
        medicines,
        diagnosis,
      });

      res.status(201).json({
        success: true,
        message: 'Prescription created successfully',
        prescriptionId,
      });
    } catch (error) {
      next(error);
    }
  };

  public getPrescriptionsByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const prescriptions = await this.prescriptionService.getPrescriptionsByPatient(patientId);
      const patient = await PatientModel.findOne({ patientId }).select('patientId firstName lastName email');
      const patientName = patient
        ? [patient.firstName, patient.lastName].filter(Boolean).join(' ')
        : '';
      const doctorIds = [...new Set(prescriptions.map((prescription) => prescription.doctorId))];
      const doctors = doctorIds.length > 0
        ? await DoctorModel.find({ doctorId: { $in: doctorIds } }).select('doctorId firstName lastName')
        : [];
      const doctorNames = new Map(doctors.map((doctor) => [
        doctor.doctorId,
        [doctor.firstName, doctor.lastName].filter(Boolean).join(' ') || 'Doctor',
      ]));

      const data = prescriptions.map((p) => ({
        prescriptionId: p.prescriptionId,
        patientId: p.patientId,
        patientName,
        patient: patient ? {
          patientId: patient.patientId,
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: patientName,
          email: patient.email,
        } : null,
        patientEmail: patient?.email || '',
        doctorId: p.doctorId,
        doctorName: doctorNames.get(p.doctorId) || p.doctorId,
        medicines: p.medicines,
        diagnosis: p.diagnosis,
        createdAt: p.createdAt,
      }));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getPrescriptionsByDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doctorId = String(req.params.doctorId);
      const user = (req as AuthenticatedRequest).user;
      if (user?.role === 'doctor') {
        const persistedUser = user.userId ? await UserModel.findById(user.userId) : null;
        const ownDoctorId = persistedUser?.role === 'doctor'
          ? await ensureUserProfile(persistedUser)
          : user.linkedId;
        if (!ownDoctorId || ownDoctorId !== doctorId) {
          throw new AppError(403, 'Doctors can only view their own prescriptions');
        }
      }
      const prescriptions = await this.prescriptionService.getPrescriptionsByDoctor(doctorId);
      const patientIds = [...new Set(prescriptions.map((prescription) => prescription.patientId))];
      const patients = patientIds.length > 0
        ? await PatientModel.find({ patientId: { $in: patientIds } }).select('patientId firstName lastName email')
        : [];
      const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));

      const data = prescriptions.map((p) => {
        const patient = patientById.get(p.patientId);
        const patientName = patient
          ? [patient.firstName, patient.lastName].filter(Boolean).join(' ')
          : '';
        return {
          prescriptionId: p.prescriptionId,
          patientId: p.patientId,
          patientName,
          patient: patient ? {
            patientId: patient.patientId,
            firstName: patient.firstName,
            lastName: patient.lastName,
            fullName: patientName,
            email: patient.email,
          } : null,
          patientEmail: patient?.email || '',
          doctorId: p.doctorId,
          medicines: p.medicines,
          diagnosis: p.diagnosis,
          createdAt: p.createdAt,
        };
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
