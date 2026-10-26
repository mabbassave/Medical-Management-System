import { Request, Response, NextFunction } from 'express';
import { VitalsApplicationService } from '../../application/vitals/VitalsApplicationService';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserModel } from '../../infrastructure/database/schemas/User.schema';
import { notificationService } from '../../infrastructure/notifications/socket';
import { AppError } from '../../domain/errors/AppError';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';
import { VitalsModel } from '../../infrastructure/database/schemas/Vitals.schema';
import { randomUUID } from 'crypto';

export class VitalsController {
  constructor(private readonly vitalsService: VitalsApplicationService) {}

  public recordVitals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const user = userId ? await UserModel.findById(userId) : null;
      const isOpticalScan = Array.isArray(req.body.selectedMetrics);
      if (
        !user ||
        (!['admin', 'doctor', 'nurse'].includes(user.role) && !(user.role === 'patient' && isOpticalScan))
      ) {
        throw new AppError(403, 'Only Doctor, Nurse, or Admin can record vitals');
      }

      const {
        patientId,
        bloodPressureSystolic,
        bloodPressureDiastolic,
        sugarLevel,
        temperature,
        heartRate,
        pulseRate,
        rbcCount,
        wbcCount,
      } = req.body;

      const doctorId = user.role === 'patient'
        ? undefined
        : user.linkedId || (user.role === 'doctor' ? await ensureUserProfile(user) : undefined);

      if (isOpticalScan) {
        const patientScan = user.role === 'patient';
        const patientScanId = patientScan ? await ensureUserProfile(user) : undefined;
        if (patientScan && !patientScanId) {
          throw new AppError(403, 'The authenticated patient profile could not be resolved');
        }
        if (!patientScan && !doctorId) {
          throw new AppError(403, 'The authenticated clinician profile could not be resolved');
        }

        const scan = await VitalsModel.create({
          vitalsId: randomUUID(),
          ...(patientScanId ? { patientId: patientScanId } : patientId ? { patientId: String(patientId) } : {}),
          ...(doctorId ? { doctorId } : {}),
          selectedMetrics: req.body.selectedMetrics,
          heartRate: req.body.heartRate,
          breathingRate: req.body.breathingRate,
          hrv: req.body.hrv,
          stressLevel: req.body.stressLevel,
          bloodPressure: req.body.bloodPressure,
          spo2: req.body.spo2,
          scanDuration: req.body.scanDuration,
          confidence: req.body.confidence,
          quality: req.body.quality,
          status: 'inconclusive',
          flaggedParams: [],
          message: req.body.qualityReason || 'Estimated values for general wellness. Not a medical diagnosis.',
          recordedAt: new Date(),
        });
        res.status(201).json({
          success: true,
          message: 'Vitals scan saved successfully',
          data: {
            vitalsId: scan.vitalsId,
            ...(scan.patientId ? { patientId: scan.patientId } : {}),
            doctorId: scan.doctorId,
            selectedMetrics: scan.selectedMetrics,
            heartRate: scan.heartRate,
            breathingRate: scan.breathingRate,
            hrv: scan.hrv,
            stressLevel: scan.stressLevel,
            bloodPressure: scan.bloodPressure,
            spo2: scan.spo2,
            scanDuration: scan.scanDuration,
            confidence: scan.confidence,
            quality: scan.quality,
            recordedAt: scan.recordedAt,
            status: scan.status,
            message: scan.message,
          },
        });
        return;
      }

      if (!doctorId) {
        throw new AppError(403, 'The authenticated clinician profile could not be resolved');
      }
      const analysisResult = await this.vitalsService.recordVitals({
        patientId,
        doctorId,
        bloodPressureSystolic: Number(bloodPressureSystolic),
        bloodPressureDiastolic: Number(bloodPressureDiastolic),
        sugarLevel: Number(sugarLevel),
        temperature: Number(temperature),
        heartRate: Number(heartRate),
        pulseRate: Number(pulseRate),
        rbcCount: Number(rbcCount),
        wbcCount: Number(wbcCount),
      });

      // Emit real-time critical vitals event to doctor and admin rooms if status is critical
      if (analysisResult.status === 'critical') {
        notificationService.emitCriticalVitals({
          patientId,
          status: analysisResult.status,
          flaggedParams: analysisResult.flaggedParams,
          message: analysisResult.message,
          summary: analysisResult.message,
          analysis: analysisResult,
          recordedAt: new Date(),
        });
      }

      res.status(201).json({
        success: true,
        message: 'Vitals recorded and analyzed successfully',
        analysis: analysisResult,
      });
    } catch (error) {
      next(error);
    }
  };

  public getVitalsByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let patientId = String(req.params.patientId || req.query.patientId || '');
      const userId = (req as AuthenticatedRequest).user?.userId;
      const user = userId ? await UserModel.findById(userId) : null;
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      if (user.role === 'patient') {
        const ownPatientId = await ensureUserProfile(user);
        if (!ownPatientId || (patientId && ownPatientId !== patientId)) {
          throw new AppError(403, 'Forbidden: Patients can only access their own data');
        }
        patientId = ownPatientId;
        req.params.patientId = ownPatientId;
      }
      if (!['patient', 'doctor', 'nurse', 'admin'].includes(user.role)) {
        throw new AppError(403, 'Forbidden');
      }

      if (!patientId) throw new AppError(400, 'patientId is required');
      const vitalsList = await VitalsModel.find({ patientId }).sort({ recordedAt: -1 }).lean();

      const data = vitalsList.map((v) => ({
        vitalsId: v.vitalsId,
        patientId: v.patientId,
        doctorId: v.doctorId,
        bloodPressureSystolic: v.bloodPressureSystolic,
        bloodPressureDiastolic: v.bloodPressureDiastolic,
        sugarLevel: v.sugarLevel,
        temperature: v.temperature,
        heartRate: v.heartRate,
        pulseRate: v.pulseRate,
        rbcCount: v.rbcCount,
        wbcCount: v.wbcCount,
        breathingRate: v.breathingRate,
        hrv: v.hrv,
        stressLevel: v.stressLevel,
        bloodPressure: v.bloodPressure,
        spo2: v.spo2,
        selectedMetrics: v.selectedMetrics,
        scanDuration: v.scanDuration,
        confidence: v.confidence,
        quality: v.quality,
        recordedAt: v.recordedAt,
        createdAt: v.createdAt,
        analysis: {
          status: v.status,
          message: v.message,
          flaggedParams: v.flaggedParams,
        },
      }));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getMyScanHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const user = userId ? await UserModel.findById(userId) : null;
      if (!user) throw new AppError(401, 'Unauthorized');
      let query: Record<string, unknown>;
      if (user.role === 'patient') {
        const patientId = await ensureUserProfile(user);
        if (!patientId) throw new AppError(403, 'The authenticated patient profile could not be resolved');
        query = { patientId };
      } else if (user.role === 'doctor') {
        const doctorId = user.linkedId || await ensureUserProfile(user);
        if (!doctorId) throw new AppError(403, 'The authenticated doctor profile could not be resolved');
        query = { doctorId, patientId: { $exists: false } };
      } else {
        throw new AppError(403, 'Only patients and doctors can view their scan history');
      }

      const scans = await VitalsModel.find(query).sort({ recordedAt: -1 }).lean();
      res.status(200).json({
        success: true,
        data: scans.map((scan) => ({
          vitalsId: scan.vitalsId,
          ...(scan.patientId ? { patientId: scan.patientId } : {}),
          ...(scan.doctorId ? { doctorId: scan.doctorId } : {}),
          selectedMetrics: scan.selectedMetrics,
          heartRate: scan.heartRate,
          breathingRate: scan.breathingRate,
          hrv: scan.hrv,
          stressLevel: scan.stressLevel,
          scanDuration: scan.scanDuration,
          confidence: scan.confidence,
          quality: scan.quality,
          recordedAt: scan.recordedAt,
          createdAt: scan.createdAt,
          analysis: { status: scan.status, message: scan.message, flaggedParams: scan.flaggedParams },
        })),
      });
    } catch (error) {
      next(error);
    }
  };
}
