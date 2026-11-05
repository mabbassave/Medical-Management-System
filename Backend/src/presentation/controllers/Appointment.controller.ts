import { Request, Response, NextFunction } from 'express';
import { AppointmentApplicationService } from '../../application/appointment/AppointmentApplicationService';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { IUserDocument, UserModel } from '../../infrastructure/database/schemas/User.schema';
import { AppError } from '../../domain/errors/AppError';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';
import { AppointmentModel } from '../../infrastructure/database/schemas/Appointment.schema';
import { DoctorModel } from '../../infrastructure/database/schemas/Doctor.schema';
import { PatientModel } from '../../infrastructure/database/schemas/Patient.schema';
import { notificationService } from '../../infrastructure/notifications/socket';
import { AppointmentActorRole } from '../../domain/appointment/Appointment.entity';

export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentApplicationService) {}

  private getAuthenticatedUser = async (req: Request) => {
    const userId = (req as AuthenticatedRequest).user?.userId;
    return userId ? UserModel.findById(userId) : null;
  };

  private getLinkedProfileId = async (user: IUserDocument) => {
    return ensureUserProfile(user);
  };

  private notifyAppointmentUpdate = async (patientId: string): Promise<void> => {
    const patient = await PatientModel.findOne({ patientId }).select('userId');
    notificationService.emitAppointmentUpdate(patient?.userId?.toString());
  };

  public bookAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let { patientId, doctorId, appointmentDate, notes } = req.body;
      const user = await this.getAuthenticatedUser(req);
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      if (user.role === 'patient') {
        const ownPatientId = await this.getLinkedProfileId(user);
        if (!ownPatientId || (patientId && ownPatientId !== patientId)) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
        patientId = ownPatientId;
        req.body.patientId = ownPatientId;
      } else if (!['admin', 'doctor', 'nurse'].includes(user.role)) {
        throw new AppError(403, 'Forbidden');
      }

      const doctor = await DoctorModel.findOne({ doctorId }).select('doctorId');
      if (!doctor) throw new AppError(404, 'Doctor not found');
      const patient = await PatientModel.exists({ patientId });
      if (!patient) throw new AppError(404, 'Patient not found');

      const appointmentId = await this.appointmentService.bookAppointment({
        patientId,
        doctorId,
        appointmentDate,
        notes,
      }, user.role as AppointmentActorRole);
      await this.notifyAppointmentUpdate(patientId);

      res.status(201).json({
        success: true,
        message: 'Appointment booked successfully',
        appointmentId,
      });
    } catch (error) {
      next((error as { code?: number })?.code === 11000
        ? new AppError(409, 'That appointment time was just booked. Choose another time.')
        : error);
    }
  };

  public cancelAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointmentId = String(req.params.appointmentId);
      const user = await this.getAuthenticatedUser(req);
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      if (!appointment) {
        throw new AppError(404, 'Appointment not found');
      }
      if (user.role === 'patient') {
        const ownPatientId = await this.getLinkedProfileId(user);
        if (!ownPatientId || appointment.patientId !== ownPatientId) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
      } else if (user.role === 'doctor') {
        const ownDoctorId = await this.getLinkedProfileId(user);
        if (!ownDoctorId || appointment.doctorId !== ownDoctorId) {
          throw new AppError(403, 'You can only cancel your own appointments');
        }
      } else if (user.role !== 'admin') {
        throw new AppError(403, 'Forbidden');
      }

      await this.appointmentService.cancelAppointment(appointmentId, user.role as AppointmentActorRole);
      await this.notifyAppointmentUpdate(appointment.patientId);

      res.status(200).json({
        success: true,
        message: 'Appointment cancelled successfully',
      });
    } catch (error) { next(error); }
  };

  public completeAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointmentId = String(req.params.appointmentId);
      const user = await this.getAuthenticatedUser(req);
      if (!user || !['doctor', 'admin'].includes(user.role)) throw new AppError(403, 'Forbidden');
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      if (!appointment) throw new AppError(404, 'Appointment not found');
      if (user.role === 'doctor') {
        const ownDoctorId = await this.getLinkedProfileId(user);
        if (!ownDoctorId || appointment.doctorId !== ownDoctorId) throw new AppError(403, 'You can only complete your own appointments');
      }
      await this.appointmentService.completeAppointment(appointmentId, user.role as AppointmentActorRole);
      await this.notifyAppointmentUpdate(appointment.patientId);
      res.status(200).json({ success: true, message: 'Appointment marked as completed.' });
    } catch (error) { next(error); }
  };

  public rescheduleAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointmentId = String(req.params.appointmentId);
      const user = await this.getAuthenticatedUser(req);
      if (!user) throw new AppError(401, 'Unauthorized');
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      if (!appointment) throw new AppError(404, 'Appointment not found');
      if (user.role === 'patient') {
        const ownPatientId = await this.getLinkedProfileId(user);
        if (!ownPatientId || appointment.patientId !== ownPatientId) throw new AppError(403, 'You can only reschedule your own appointments');
      } else if (user.role === 'doctor') {
        const ownDoctorId = await this.getLinkedProfileId(user);
        if (!ownDoctorId || appointment.doctorId !== ownDoctorId) throw new AppError(403, 'You can only reschedule your own appointments');
      } else if (user.role !== 'admin') {
        throw new AppError(403, 'Forbidden');
      }
      await this.appointmentService.rescheduleAppointment(appointmentId, req.body.appointmentDate, user.role as AppointmentActorRole);
      await this.notifyAppointmentUpdate(appointment.patientId);
      res.status(200).json({ success: true, message: 'Appointment rescheduled successfully.' });
    } catch (error) {
      next((error as { code?: number })?.code === 11000
        ? new AppError(409, 'That appointment time was just booked. Choose another time.')
        : error);
    }
  };

  public getAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.getAuthenticatedUser(req);
      if (!user) throw new AppError(401, 'Unauthorized');
      const doctorId = String(req.query.doctorId || '');
      const start = new Date(String(req.query.start || ''));
      const end = new Date(String(req.query.end || ''));
      if (!doctorId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end || end.getTime() - start.getTime() > 26 * 60 * 60 * 1000) {
        throw new AppError(400, 'A doctor and valid one-day date range are required');
      }
      if (user.role === 'doctor') {
        const ownDoctorId = await this.getLinkedProfileId(user);
        if (!ownDoctorId || ownDoctorId !== doctorId) throw new AppError(403, 'You can only view your own availability');
      } else if (!['patient', 'admin'].includes(user.role)) {
        throw new AppError(403, 'Forbidden');
      }
      const doctorExists = await DoctorModel.exists({ doctorId });
      if (!doctorExists) throw new AppError(404, 'Doctor not found');
      const appointments = await AppointmentModel.find({
        doctorId,
        status: 'SCHEDULED',
        appointmentDate: { $gte: start, $lt: end },
      } as any).select('appointmentDate').lean();
      res.status(200).json({ success: true, data: { bookedSlots: appointments.map(({ appointmentDate }) => appointmentDate) } });
    } catch (error) { next(error); }
  };

  public getAppointmentsByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let patientId = String(req.params.patientId);
      const user = await this.getAuthenticatedUser(req);
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      if (user.role === 'patient') {
        const ownPatientId = await this.getLinkedProfileId(user);
        if (!ownPatientId || (patientId && ownPatientId !== patientId)) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
        patientId = ownPatientId;
        req.params.patientId = ownPatientId;
      } else if (!['admin', 'doctor', 'nurse'].includes(user.role)) {
        throw new AppError(403, 'Forbidden');
      }

      const appointments = await this.appointmentService.getAppointmentsByPatient(patientId);

      const data = appointments.map((app) => ({
        appointmentId: app.appointmentId,
        patientId: app.patientId,
        doctorId: app.doctorId,
        appointmentDate: app.appointmentDate,
        status: app.status,
        notes: app.notes,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        activityHistory: app.activityHistory,
      }));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAppointmentsByDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doctorId = String(req.params.doctorId);
      const user = await this.getAuthenticatedUser(req);
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      if (user.role === 'doctor') {
        const ownDoctorId = await this.getLinkedProfileId(user);
        if (!ownDoctorId || ownDoctorId !== doctorId) {
          throw new AppError(403, 'You can only view your own appointments');
        }
      } else if (user.role !== 'admin') {
        throw new AppError(403, 'Forbidden');
      }

      const appointments = await this.appointmentService.getAppointmentsByDoctor(doctorId);

      const data = appointments.map((app) => ({
        appointmentId: app.appointmentId,
        patientId: app.patientId,
        doctorId: app.doctorId,
        appointmentDate: app.appointmentDate,
        status: app.status,
        notes: app.notes,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        activityHistory: app.activityHistory,
      }));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAllAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.getAuthenticatedUser(req);
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      if (user.role === 'doctor') {
        const ownDoctorId = await this.getLinkedProfileId(user);
        if (!ownDoctorId) {
          throw new AppError(403, 'No doctor profile is linked to your account.');
        }
        const ownAppointments = await this.appointmentService.getAppointmentsByDoctor(ownDoctorId);
        res.status(200).json({
          success: true,
          data: ownAppointments.map((app) => ({
            appointmentId: app.appointmentId,
            patientId: app.patientId,
            doctorId: app.doctorId,
            appointmentDate: app.appointmentDate,
            status: app.status,
            notes: app.notes,
          })),
        });
        return;
      }
      if (user.role !== 'admin') {
        throw new AppError(403, 'Forbidden');
      }

      const appointments = await this.appointmentService.getAllAppointments();

      const data = appointments.map((app) => ({
        appointmentId: app.appointmentId,
        patientId: app.patientId,
        doctorId: app.doctorId,
        appointmentDate: app.appointmentDate,
        status: app.status,
        notes: app.notes,
      }));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointmentId = String(req.params.appointmentId);
      const user = await this.getAuthenticatedUser(req);
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);

      if (!appointment) {
        throw new AppError(404, 'Appointment not found');
      }

      if (user.role === 'patient') {
        const ownPatientId = await this.getLinkedProfileId(user);
        if (!ownPatientId || appointment.patientId !== ownPatientId) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
      } else if (user.role === 'doctor') {
        const ownDoctorId = await this.getLinkedProfileId(user);
        if (!ownDoctorId || appointment.doctorId !== ownDoctorId) {
          throw new AppError(403, 'You can only view your own appointments');
        }
      } else if (user.role !== 'admin') {
        throw new AppError(403, 'Forbidden');
      }

      res.status(200).json({
        success: true,
        data: {
          appointmentId: appointment.appointmentId,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          appointmentDate: appointment.appointmentDate,
          status: appointment.status,
          notes: appointment.notes,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
