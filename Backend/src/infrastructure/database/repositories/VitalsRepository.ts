import { IVitalsRepository } from '../../../domain/vitals/IVitalsRepository';
import { Vitals } from '../../../domain/vitals/Vitals.entity';
import { VitalsAnalysisResult, VitalsStatus } from '../../../domain/vitals/VitalsAnalysisResult';
import { VitalsModel, IVitalsDocument } from '../schemas/Vitals.schema';

export class VitalsRepository implements IVitalsRepository {
  public async save(vitals: Vitals): Promise<void> {
    await VitalsModel.create({
      vitalsId: vitals.vitalsId,
      patientId: vitals.patientId,
      doctorId: vitals.doctorId,
      bloodPressureSystolic: vitals.bloodPressureSystolic,
      bloodPressureDiastolic: vitals.bloodPressureDiastolic,
      sugarLevel: vitals.sugarLevel,
      temperature: vitals.temperature,
      heartRate: vitals.heartRate,
      pulseRate: vitals.pulseRate,
      rbcCount: vitals.rbcCount,
      wbcCount: vitals.wbcCount,
      status: vitals.analysisResult?.status || 'normal',
      flaggedParams: vitals.analysisResult?.flaggedParams || [],
      message: vitals.analysisResult?.message || '',
      recordedAt: vitals.recordedAt,
    });
  }

  public async findById(vitalsId: string): Promise<Vitals | null> {
    const doc = await VitalsModel.findOne({ vitalsId });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findByPatientId(patientId: string): Promise<Vitals[]> {
    const docs = await VitalsModel.find({ patientId }).sort({ recordedAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  public async findAll(): Promise<Vitals[]> {
    const docs = await VitalsModel.find().sort({ recordedAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: IVitalsDocument): Vitals {
    const analysisResult = new VitalsAnalysisResult(
      doc.status as VitalsStatus,
      doc.flaggedParams,
      doc.message
    );

    return new Vitals({
      vitalsId: doc.vitalsId,
      patientId: doc.patientId,
      bloodPressureSystolic: doc.bloodPressureSystolic,
      bloodPressureDiastolic: doc.bloodPressureDiastolic,
      sugarLevel: doc.sugarLevel,
      temperature: doc.temperature,
      heartRate: doc.heartRate,
      pulseRate: doc.pulseRate,
      rbcCount: doc.rbcCount,
      wbcCount: doc.wbcCount,
      recordedAt: new Date(doc.recordedAt),
      analysisResult,
    });
  }
}
