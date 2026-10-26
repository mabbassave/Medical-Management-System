// Builds a factual spoken or written summary from a returned vitals report.
export interface VitalsValues {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  sugarLevel?: number;
  temperature?: number;
  heartRate?: number;
  pulseRate?: number;
  rbcCount?: number;
  wbcCount?: number;
}

export interface VitalsAnalysisSummary {
  status?: string;
  flaggedParams?: string[];
  message?: string;
  details?: unknown;
  trendNotes?: unknown;
  rangesUsed?: unknown;
}

export type SummaryLanguage = 'en' | 'ur';

const DISCLAIMER = 'This is an automatic check, not a medical diagnosis. Please consult a doctor.';
const URDU_DISCLAIMER = 'یہ ایک خودکار جانچ ہے، طبی تشخیص نہیں۔ براہِ کرم ڈاکٹر سے مشورہ کریں۔';

const readings: Array<{
  keys: string[];
  label: string;
  urduLabel: string;
  value: (vitals: VitalsValues) => number | undefined;
  unit: string;
}> = [
  {
    keys: ['blood pressure', 'systolic', 'diastolic'],
    label: 'Blood pressure',
    urduLabel: 'بلڈ پریشر',
    value: (vitals) => vitals.bloodPressureSystolic !== undefined && vitals.bloodPressureDiastolic !== undefined
      ? vitals.bloodPressureSystolic
      : undefined,
    unit: 'mmHg',
  },
  { keys: ['sugar', 'glucose'], label: 'Blood sugar', urduLabel: 'خون میں شکر', value: (vitals) => vitals.sugarLevel, unit: 'mg/dL' },
  { keys: ['temperature', 'temp'], label: 'Temperature', urduLabel: 'درجہ حرارت', value: (vitals) => vitals.temperature, unit: '°F' },
  { keys: ['heart rate', 'heart'], label: 'Heart rate', urduLabel: 'دل کی دھڑکن', value: (vitals) => vitals.heartRate, unit: 'bpm' },
  { keys: ['pulse'], label: 'Pulse rate', urduLabel: 'نبض', value: (vitals) => vitals.pulseRate, unit: 'bpm' },
  { keys: ['rbc', 'red blood'], label: 'RBC count', urduLabel: 'سرخ خلیات کی تعداد', value: (vitals) => vitals.rbcCount, unit: 'million/µL' },
  { keys: ['wbc', 'white blood'], label: 'WBC count', urduLabel: 'سفید خلیات کی تعداد', value: (vitals) => vitals.wbcCount, unit: '/µL' },
];

const toSourceText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(toSourceText).filter(Boolean).join('; ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${toSourceText(item)}`)
      .filter((entry) => !entry.endsWith(': '))
      .join('; ');
  }
  return value === undefined || value === null ? '' : String(value);
};

const getDetailsFor = (details: unknown, keys: string[]): string => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return toSourceText(details);
  const entries = Object.entries(details);
  const match = entries.find(([key]) => keys.some((part) => key.toLowerCase().includes(part)));
  return match ? toSourceText(match[1]) : '';
};

export const buildVitalsSummary = (
  patientName: string,
  vitals: VitalsValues,
  analysis: VitalsAnalysisSummary,
  language: SummaryLanguage = 'en'
): string => {
  const flagged = analysis.flaggedParams || [];
  const flaggedReadings = readings.filter((reading) =>
    flagged.some((flag) => reading.keys.some((key) => flag.toLowerCase().includes(key)))
  );
  const normalReadings = readings.filter(
    (reading) => reading.value(vitals) !== undefined && !flaggedReadings.includes(reading)
  );
  const bpIsFlagged = flaggedReadings.some((reading) => reading.label === 'Blood pressure');
  const bpValue = vitals.bloodPressureSystolic !== undefined && vitals.bloodPressureDiastolic !== undefined
    ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
    : '';
  const status = analysis.status;
  const detailLines = flaggedReadings.map((reading) => {
    if (reading.label === 'Blood pressure' && bpValue) {
      const details = getDetailsFor(analysis.details, reading.keys);
      return language === 'ur'
        ? `${reading.urduLabel}: ${bpValue} ${reading.unit}${details ? `. ${details}` : ''}`
        : `${reading.label}: ${bpValue} ${reading.unit}${details ? `. ${details}` : ''}`;
    }
    const value = reading.value(vitals);
    if (value === undefined) return '';
    const details = getDetailsFor(analysis.details, reading.keys);
    const label = language === 'ur' ? reading.urduLabel : reading.label;
    return `${label}: ${value} ${reading.unit}${details ? `. ${details}` : ''}`;
  }).filter(Boolean);

  const normalText = normalReadings.map((reading) => {
    if (
      reading.label === 'Blood pressure'
      && vitals.bloodPressureSystolic !== undefined
      && vitals.bloodPressureDiastolic !== undefined
    ) {
      return language === 'ur'
        ? `${reading.urduLabel} ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} ${reading.unit}`
        : `${reading.label} ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} ${reading.unit}`;
    }
    const value = reading.value(vitals);
    if (value === undefined) return '';
    const label = language === 'ur' ? reading.urduLabel : reading.label;
    return `${label} ${value} ${reading.unit}`;
  }).filter(Boolean).join(language === 'ur' ? '، ' : ', ');

  const trends = toSourceText(analysis.trendNotes);
  const ranges = toSourceText(analysis.rangesUsed);
  if (language === 'ur') {
    const lines = [
      status
        ? `${patientName} کے خودکار وائیٹل چیک کا نتیجہ ${status === 'critical' ? 'تشویشناک' : status === 'warning' ? 'توجہ طلب' : status === 'normal' ? 'معمول کے مطابق' : status} ہے۔`
        : `${patientName} کی وائیٹل ریڈنگز کا خلاصہ۔`,
      bpIsFlagged || detailLines.length > 0 ? `حد سے باہر ریڈنگز: ${detailLines.join('؛ ')}` : '',
      flagged.length > 0 ? `نشان زدہ پیرامیٹرز: ${flagged.join('، ')}` : '',
      analysis.message ? `تجزیے کا پیغام: ${analysis.message}` : '',
      trends ? `رجحان: ${trends}` : '',
      normalText ? `دیگر ریڈنگز: ${normalText}` : '',
      ranges ? `استعمال شدہ حدود: ${ranges}` : '',
      URDU_DISCLAIMER,
    ].filter(Boolean);
    return lines.join(' ');
  }

  const lines = [
    status
      ? `Automatic vitals check for ${patientName}: status ${status}.`
      : `Vitals summary for ${patientName}.`,
    detailLines.length > 0 ? `Flagged readings: ${detailLines.join('; ')}.` : '',
    flagged.length > 0 ? `Flagged parameters: ${flagged.join(', ')}.` : '',
    analysis.message ? `Analysis message: ${analysis.message}` : '',
    trends ? `Trend notes: ${trends}.` : '',
    normalText ? `Other readings: ${normalText}.` : '',
    ranges ? `Ranges used: ${ranges}.` : '',
    DISCLAIMER,
  ].filter(Boolean);
  return lines.join(' ');
};
