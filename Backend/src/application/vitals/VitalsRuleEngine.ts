import { VitalsAnalysisResult, VitalsStatus } from '../../domain/vitals/VitalsAnalysisResult';
import { RecordVitalsDTO } from './RecordVitalsDTO';

export class VitalsRuleEngine {
  public static analyzeVitals(dto: RecordVitalsDTO): VitalsAnalysisResult {
    const flaggedParams: string[] = [];
    let isCritical = false;

    // 1. Blood Pressure (Normal: 90-120 systolic / 60-80 diastolic)
    if (
      dto.bloodPressureSystolic > 180 ||
      dto.bloodPressureSystolic < 70 ||
      dto.bloodPressureDiastolic > 120 ||
      dto.bloodPressureDiastolic < 40
    ) {
      flaggedParams.push('Blood Pressure (Critical)');
      isCritical = true;
    } else if (
      dto.bloodPressureSystolic < 90 ||
      dto.bloodPressureSystolic > 120 ||
      dto.bloodPressureDiastolic < 60 ||
      dto.bloodPressureDiastolic > 80
    ) {
      flaggedParams.push('Blood Pressure (Abnormal)');
    }

    // 2. Sugar Level (Normal: 70-140 mg/dL)
    if (dto.sugarLevel < 50 || dto.sugarLevel > 300) {
      flaggedParams.push('Sugar Level (Critical)');
      isCritical = true;
    } else if (dto.sugarLevel < 70 || dto.sugarLevel > 140) {
      flaggedParams.push('Sugar Level (Abnormal)');
    }

    // 3. Temperature (Normal: 97-99°F, Fever > 100.4°F)
    if (dto.temperature > 103 || dto.temperature < 95) {
      flaggedParams.push('Temperature (Critical)');
      isCritical = true;
    } else if (dto.temperature > 100.4) {
      flaggedParams.push('Temperature (Fever)');
    } else if (dto.temperature < 97 || dto.temperature > 99) {
      flaggedParams.push('Temperature (Abnormal)');
    }

    // 4. Heart Rate (Normal: 60-100 bpm)
    if (dto.heartRate < 40 || dto.heartRate > 150) {
      flaggedParams.push('Heart Rate (Critical)');
      isCritical = true;
    } else if (dto.heartRate < 60 || dto.heartRate > 100) {
      flaggedParams.push('Heart Rate (Abnormal)');
    }

    // 5. Pulse Rate (Normal: 60-100 bpm)
    if (dto.pulseRate < 60 || dto.pulseRate > 100) {
      flaggedParams.push('Pulse Rate (Abnormal)');
    }

    // 6. RBC Count (Normal: 4.2-5.9 million/µL)
    if (dto.rbcCount < 4.2 || dto.rbcCount > 5.9) {
      flaggedParams.push('RBC Count (Abnormal)');
    }

    // 7. WBC Count (Normal: 4000-11000 /µL)
    if (dto.wbcCount < 4000 || dto.wbcCount > 11000) {
      flaggedParams.push('WBC Count (Abnormal)');
    }

    // Determine status & summary message
    let status: VitalsStatus = 'normal';
    let message = 'All vitals are within normal range.';

    if (isCritical) {
      status = 'critical';
      message = `Critical vitals detected: ${flaggedParams.join(', ')}. Immediate medical intervention required.`;
    } else if (flaggedParams.length > 0) {
      status = 'warning';
      message = `Abnormal vitals detected: ${flaggedParams.join(', ')}. Medical consultation recommended.`;
    }

    return new VitalsAnalysisResult(status, flaggedParams, message);
  }
}
