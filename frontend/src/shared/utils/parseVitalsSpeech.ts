// Extracts supported vital measurements from dictated text.
export interface ParsedVitals {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  sugarLevel?: number;
  temperature?: number;
  heartRate?: number;
  pulseRate?: number;
  rbcCount?: number;
  wbcCount?: number;
}

// Examples: "BP 120 over 80, sugar 95, temp 98.6"
// "heart rate 72, pulse 70, RBC 4.8, WBC 6500"
export const parseVitalsSpeech = (sentence: string): ParsedVitals => {
  const parsed: ParsedVitals = {};
  const number = '(\\d+(?:\\.\\d+)?)';
  const bloodPressure = new RegExp(`\\b(?:blood\\s+pressure|bp)\\s*${number}\\s*(?:over|/)\\s*${number}`, 'i')
    .exec(sentence);
  if (bloodPressure) {
    parsed.bloodPressureSystolic = Number(bloodPressure[1]);
    parsed.bloodPressureDiastolic = Number(bloodPressure[2]);
  }

  const fields: Array<{ key: keyof ParsedVitals; keywords: string[] }> = [
    { key: 'sugarLevel', keywords: ['blood sugar', 'sugar', 'glucose'] },
    { key: 'temperature', keywords: ['temperature', 'temp'] },
    { key: 'heartRate', keywords: ['heart rate', 'heart rate'] },
    { key: 'pulseRate', keywords: ['pulse rate', 'pulse'] },
    { key: 'rbcCount', keywords: ['rbc', 'red blood cells'] },
    { key: 'wbcCount', keywords: ['wbc', 'white blood cells'] },
  ];

  fields.forEach(({ key, keywords }) => {
    for (const keyword of keywords) {
      const expression = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\s*(?:is\\s*)?${number}`, 'i');
      const match = expression.exec(sentence);
      if (match) {
        parsed[key] = Number(match[1]);
        break;
      }
    }
  });

  return parsed;
};
