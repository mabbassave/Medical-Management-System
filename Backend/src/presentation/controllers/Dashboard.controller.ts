import { Request, Response, NextFunction } from 'express';
import { PatientModel } from '../../infrastructure/database/schemas/Patient.schema';
import { DoctorModel } from '../../infrastructure/database/schemas/Doctor.schema';
import { AppointmentModel } from '../../infrastructure/database/schemas/Appointment.schema';
import { VitalsModel } from '../../infrastructure/database/schemas/Vitals.schema';

export class DashboardController {
  public getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Execute efficient count queries in parallel without fetching full documents
      const [
        totalPatients,
        totalDoctors,
        totalAppointments,
        appointmentsToday,
        criticalVitalsCount,
      ] = await Promise.all([
        PatientModel.countDocuments().exec(),
        DoctorModel.countDocuments().exec(),
        AppointmentModel.countDocuments().exec(),
        AppointmentModel.countDocuments({
          appointmentDate: { $gte: startOfDay, $lte: endOfDay },
        }).exec(),
        VitalsModel.countDocuments({ status: 'critical' }).exec(),
      ]);

      res.status(200).json({
        success: true,
        totalPatients,
        totalDoctors,
        totalAppointments,
        appointmentsToday,
        criticalVitalsCount,
        data: {
          totalPatients,
          totalDoctors,
          totalAppointments,
          appointmentsToday,
          criticalVitalsCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
