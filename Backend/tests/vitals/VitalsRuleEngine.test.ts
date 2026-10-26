import { describe, it, expect } from 'vitest';
import { VitalsRuleEngine } from '../../src/application/vitals/VitalsRuleEngine';
import { RecordVitalsDTO } from '../../src/application/vitals/RecordVitalsDTO';

describe('VitalsRuleEngine', () => {
  const baseNormalVitals: RecordVitalsDTO = {
    patientId: 'patient-123',
    bloodPressureSystolic: 115,
    bloodPressureDiastolic: 75,
    sugarLevel: 95,
    temperature: 98.6,
    heartRate: 72,
    pulseRate: 72,
    rbcCount: 5.0,
    wbcCount: 7000,
  };

  describe('Normal Vitals', () => {
    it('should classify all in-range vitals as normal', () => {
      const result = VitalsRuleEngine.analyzeVitals(baseNormalVitals);

      expect(result.status).toBe('normal');
      expect(result.flaggedParams).toEqual([]);
      expect(result.message).toContain('All vitals are within normal range');
    });
  });

  describe('Warning / Abnormal Vitals', () => {
    it('should classify elevated blood pressure as warning (abnormal)', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        bloodPressureSystolic: 135,
        bloodPressureDiastolic: 85,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('warning');
      expect(result.flaggedParams).toContain('Blood Pressure (Abnormal)');
      expect(result.message).toContain('Abnormal vitals detected');
    });

    it('should classify mild/moderate fever as warning (fever)', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        temperature: 101.5,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('warning');
      expect(result.flaggedParams).toContain('Temperature (Fever)');
    });

    it('should classify abnormal blood sugar level as warning', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        sugarLevel: 160,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('warning');
      expect(result.flaggedParams).toContain('Sugar Level (Abnormal)');
    });

    it('should classify multiple non-critical deviations as warning', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        heartRate: 110,
        pulseRate: 110,
        rbcCount: 3.5,
        wbcCount: 13000,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('warning');
      expect(result.flaggedParams).toContain('Heart Rate (Abnormal)');
      expect(result.flaggedParams).toContain('Pulse Rate (Abnormal)');
      expect(result.flaggedParams).toContain('RBC Count (Abnormal)');
      expect(result.flaggedParams).toContain('WBC Count (Abnormal)');
    });
  });

  describe('Critical Vitals', () => {
    it('should classify hypertensive crisis (BP > 180 / > 120) as critical', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        bloodPressureSystolic: 195,
        bloodPressureDiastolic: 125,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('critical');
      expect(result.flaggedParams).toContain('Blood Pressure (Critical)');
      expect(result.message).toContain('Critical vitals detected');
      expect(result.message).toContain('Immediate medical intervention required');
    });

    it('should classify severe hypotension (BP < 70 / < 40) as critical', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        bloodPressureSystolic: 65,
        bloodPressureDiastolic: 38,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('critical');
      expect(result.flaggedParams).toContain('Blood Pressure (Critical)');
    });

    it('should classify severe hypoglycemia (sugar < 50) as critical', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        sugarLevel: 42,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('critical');
      expect(result.flaggedParams).toContain('Sugar Level (Critical)');
    });

    it('should classify extreme hyperglycemia (sugar > 300) as critical', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        sugarLevel: 360,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('critical');
      expect(result.flaggedParams).toContain('Sugar Level (Critical)');
    });

    it('should classify hyperpyrexia (temp > 103) as critical', () => {
      const vitals: RecordVitalsDTO = {
        ...baseNormalVitals,
        temperature: 104.2,
      };

      const result = VitalsRuleEngine.analyzeVitals(vitals);

      expect(result.status).toBe('critical');
      expect(result.flaggedParams).toContain('Temperature (Critical)');
    });

    it('should classify extreme heart rates (< 40 or > 150) as critical', () => {
      const severeBradycardia = VitalsRuleEngine.analyzeVitals({
        ...baseNormalVitals,
        heartRate: 35,
      });
      expect(severeBradycardia.status).toBe('critical');
      expect(severeBradycardia.flaggedParams).toContain('Heart Rate (Critical)');

      const severeTachycardia = VitalsRuleEngine.analyzeVitals({
        ...baseNormalVitals,
        heartRate: 165,
      });
      expect(severeTachycardia.status).toBe('critical');
      expect(severeTachycardia.flaggedParams).toContain('Heart Rate (Critical)');
    });
  });
});
