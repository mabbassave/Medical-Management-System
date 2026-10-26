import { Request, Response, NextFunction } from 'express';
import { PatientApplicationService } from '../../application/patient/PatientApplicationService';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { PatientModel } from '../../infrastructure/database/schemas/Patient.schema';
import { AppointmentModel } from '../../infrastructure/database/schemas/Appointment.schema';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';
import { AppError } from '../../domain/errors/AppError';

export class PatientController {
  constructor(private readonly patientService: PatientApplicationService) {}

  public createPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { firstName, lastName, email, phone, dateOfBirth } = req.body;

      const patientId = await this.patientService.createPatient({
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
      });

      const user = await UserModel.findOne({ email: email.trim().toLowerCase(), role: 'patient' });
      if (user) {
        await PatientModel.findOneAndUpdate({ patientId }, { userId: user._id });
        user.linkedId = patientId;
        await user.save();
      }

      res.status(201).json({
        success: true,
        message: 'Patient created successfully',
        patientId,
      });
    } catch (error) {
      next(error);
    }
  };

  public getMyPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const user = userId ? await UserModel.findById(userId) : null;

      if (!user || user.role !== 'patient') {
        throw new AppError(403, 'Forbidden');
      }

      const linkedId = await ensureUserProfile(user);
      if (!linkedId) {
        throw new AppError(500, 'Unable to link patient profile');
      }

      const patient = await this.patientService.getPatient(linkedId);
      res.status(200).json({
        success: true,
        data: {
          patientId: patient.patientId.getValue(),
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: patient.fullName,
          email: patient.email.getValue(),
          phone: patient.phone,
          dateOfBirth: patient.dateOfBirth,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      let patientId = String(req.params.patientId);

      if (user?.role === 'patient') {
        let patientLinkedId = user.linkedId;
        if (!patientLinkedId && user.userId) {
          const u = await UserModel.findById(user.userId);
          patientLinkedId = u?.linkedId;
        }
        if (!patientLinkedId || (patientId && patientId !== patientLinkedId)) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
        if (patientLinkedId) {
          patientId = patientLinkedId;
          req.params.patientId = patientLinkedId;
        }
      }

      const patient = await this.patientService.getPatient(patientId);

      res.status(200).json({
        success: true,
        data: {
          patientId: patient.patientId.getValue(),
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: patient.fullName,
          email: patient.email.getValue(),
          phone: patient.phone,
          dateOfBirth: patient.dateOfBirth,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getAllPatients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patients = await this.patientService.getAllPatients();
      // Development roster: doctors can see existing patient profiles even before
      // appointments have been created. Patient self-access stays on /me and
      // patient-specific routes retain their existing authorization middleware.
      const data = patients.map((patient) => ({
        patientId: patient.patientId.getValue(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        fullName: patient.fullName,
        email: patient.email.getValue(),
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
      }));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAssignedPatients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const user = userId ? await UserModel.findById(userId) : null;
      if (!user || user.role !== 'doctor') throw new AppError(403, 'Only doctors can view their assigned patient list');
      const doctorId = await ensureUserProfile(user);
      if (!doctorId) throw new AppError(403, 'No doctor profile is linked to this account');
      const patientIds = await AppointmentModel.distinct('patientId', { doctorId });
      const patients = await PatientModel.find({ patientId: { $in: patientIds } }).sort({ firstName: 1, lastName: 1 }).lean();
      res.status(200).json({
        success: true,
        data: patients.map((patient) => ({
          patientId: patient.patientId,
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
          email: patient.email,
          phone: patient.phone,
          dateOfBirth: patient.dateOfBirth,
        })),
      });
    } catch (error) {
      next(error);
    }
  };
}
