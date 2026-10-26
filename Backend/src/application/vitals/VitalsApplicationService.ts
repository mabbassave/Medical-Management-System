import { randomUUID } from 'crypto';
import { IVitalsRepository } from '../../domain/vitals/IVitalsRepository';
import { Vitals } from '../../domain/vitals/Vitals.entity';
import { VitalsAnalysisResult } from '../../domain/vitals/VitalsAnalysisResult';
import { RecordVitalsDTO } from './RecordVitalsDTO';
import { VitalsRuleEngine } from './VitalsRuleEngine';

export class VitalsApplicationService {
  constructor(private readonly vitalsRepository: IVitalsRepository) {}

  public async recordVitals(dto: RecordVitalsDTO): Promise<VitalsAnalysisResult> {
    // Run rule-based analysis
    const analysisResult = VitalsRuleEngine.analyzeVitals(dto);

    // Create domain entity
    const vitals = Vitals.create({
      vitalsId: randomUUID(),
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      bloodPressureSystolic: dto.bloodPressureSystolic,
      bloodPressureDiastolic: dto.bloodPressureDiastolic,
      sugarLevel: dto.sugarLevel,
      temperature: dto.temperature,
      heartRate: dto.heartRate,
      pulseRate: dto.pulseRate,
      rbcCount: dto.rbcCount,
      wbcCount: dto.wbcCount,
      recordedAt: new Date(),
      analysisResult,
    });

    // Save vitals and analysis result
    await this.vitalsRepository.save(vitals);

    return analysisResult;
  }

  public async getVitalsByPatient(patientId: string): Promise<Vitals[]> {
    return await this.vitalsRepository.findByPatientId(patientId);
  }
}
