import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CheckCircle2, Clock3, Info, RefreshCw, ScanLine, ShieldCheck, Video, VideoOff } from 'lucide-react';
import type { VitalsRecord } from '../../shared/services/vitals';
import api from '../../shared/services/api';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import { DashboardLayout } from '../templates/DashboardLayout';
import { useAuthStore } from '../../store/authStore';
import './FaceVitals.css';

type QualityLabel = 'Good' | 'Low' | 'Poor' | 'Unavailable';
type ScanResult = {
  heartRate?: number;
  breathingRate?: number;
  hrv?: number;
  stressLevel?: number;
  quality: number | null;
  qualityLabel: QualityLabel;
  qualityReason?: string;
  reasons: Partial<Record<'heartRate' | 'breathingRate' | 'hrv' | 'stressLevel', string>>;
  timestamp: string;
};
type ScanHistoryRecord = Omit<VitalsRecord, 'patientId'> & { patientId?: string };
interface RgbSample { time: number; cameraTimestamp: number; red: number; green: number; blue: number; motion: number; brightness: number; }

const scanDurationSeconds = 30;
const minimumCaptureFps = 10;
const storedMetrics = ['heartRate', 'breathingRate', 'hrv', 'stressLevel'];
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

const detrend = (values: number[]): number[] => {
  if (!values.length) return [];
  const center = (values.length - 1) / 2;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const slope = values.reduce((sum, value, index) => sum + (index - center) * (value - mean), 0)
    / Math.max(1, values.reduce((sum, _value, index) => sum + (index - center) ** 2, 0));
  return values.map((value, index) => value - mean - slope * (index - center));
};

const filterBiquad = (values: number[], sampleRate: number, cutoff: number, highPass: boolean): number[] => {
  const omega = 2 * Math.PI * cutoff / sampleRate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / Math.SQRT2;
  const a0 = 1 + alpha;
  const b0 = highPass ? (1 + cosine) / 2 : (1 - cosine) / 2;
  const b1 = highPass ? -(1 + cosine) : 1 - cosine;
  const b2 = b0;
  const a1 = -2 * cosine;
  const a2 = 1 - alpha;
  const output: number[] = [];
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (const input of values) {
    const current = (b0 / a0) * input + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    output.push(current);
    x2 = x1; x1 = input; y2 = y1; y1 = current;
  }
  return output;
};

const fft = (real: Float64Array, imaginary: Float64Array): void => {
  const length = real.length;
  for (let i = 1, j = 0; i < length; i++) {
    let bit = length >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let size = 2; size <= length; size <<= 1) {
    const angle = -2 * Math.PI / size;
    const stepReal = Math.cos(angle); const stepImaginary = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let twiddleReal = 1; let twiddleImaginary = 0;
      for (let offset = 0; offset < size / 2; offset++) {
        const even = start + offset; const odd = even + size / 2;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal; imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal; imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
};

const spectrumPeak = (values: number[], sampleRate: number, lowHz: number, highHz: number) => {
  if (values.length < 64 || !Number.isFinite(sampleRate) || sampleRate < highHz * 2 || values.some((value) => !Number.isFinite(value))) return null;
  const size = 2 ** Math.ceil(Math.log2(values.length));
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  for (let index = 0; index < values.length; index++) {
    const hann = values.length > 1 ? 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (values.length - 1)) : 1;
    real[index] = values[index] * hann;
  }
  fft(real, imaginary);
  let peakIndex = -1; let peakPower = 0; let bandPower = 0; const powers: number[] = [];
  for (let index = 1; index < size / 2; index++) {
    const frequency = index * sampleRate / size;
    const power = real[index] ** 2 + imaginary[index] ** 2;
    if (frequency >= lowHz && frequency <= highHz) {
      powers.push(power); bandPower += power;
      if (power > peakPower) { peakPower = power; peakIndex = index; }
    }
  }
  if (peakIndex < 0 || !Number.isFinite(peakPower) || peakPower <= 0 || !powers.length) return null;
  const noisePowers = powers.filter((power) => power < peakPower * 0.8);
  const noise = noisePowers.length ? noisePowers.reduce((sum, power) => sum + power, 0) / noisePowers.length : bandPower / Math.max(1, powers.length);
  const frequency = peakIndex * sampleRate / size;
  const snrDb = 10 * Math.log10(peakPower / Math.max(noise, 1e-12));
  return Number.isFinite(frequency) && Number.isFinite(snrDb) ? { frequency, snrDb } : null;
};

const resampleAt30Hz = (samples: RgbSample[]): RgbSample[] => {
  const valid = samples.filter((sample) => [sample.time, sample.red, sample.green, sample.blue, sample.motion, sample.brightness].every(Number.isFinite))
    .sort((a, b) => a.time - b.time);
  if (valid.length < 2) return [];
  const unique = valid.filter((sample, index) => index === 0 || sample.time > valid[index - 1].time);
  const start = unique[0].time;
  const end = unique[unique.length - 1].time;
  if (!(end > start)) return [];
  const count = Math.floor((end - start) / (1000 / 30)) + 1;
  const output: RgbSample[] = [];
  let right = 1;
  for (let index = 0; index < count; index++) {
    const time = start + index * (1000 / 30);
    while (right < unique.length - 1 && unique[right].time < time) right += 1;
    const before = unique[right - 1]; const after = unique[right];
    const gap = after.time - before.time;
    if (!(gap > 0) || gap > 250) continue;
    const ratio = clamp((time - before.time) / gap, 0, 1);
    const interpolate = (key: 'red' | 'green' | 'blue' | 'motion' | 'brightness') => before[key] + (after[key] - before[key]) * ratio;
    output.push({ time, cameraTimestamp: time, red: interpolate('red'), green: interpolate('green'), blue: interpolate('blue'), motion: interpolate('motion'), brightness: interpolate('brightness') });
  }
  return output;
};

const slidingPosSignal = (samples: RgbSample[], sampleRate: number): number[] => {
  const windowSamples = Math.max(8, Math.round(sampleRate * 1.6));
  const accumulated = new Array<number>(samples.length).fill(0);
  const counts = new Array<number>(samples.length).fill(0);
  const standardDeviation = (values: number[]) => {
    if (!values.length) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  };
  for (let start = 0; start + windowSamples <= samples.length; start++) {
    const window = samples.slice(start, start + windowSamples);
    const means = (['red', 'green', 'blue'] as const).map((channel) => window.reduce((sum, sample) => sum + sample[channel], 0) / window.length);
    if (means.some((mean) => !Number.isFinite(mean) || mean <= 0)) continue;
    const s1: number[] = []; const s2: number[] = [];
    for (const sample of window) {
      const red = sample.red / means[0] - 1;
      const green = sample.green / means[1] - 1;
      const blue = sample.blue / means[2] - 1;
      s1.push(green - blue);
      s2.push(green + blue - 2 * red);
    }
    const alpha = standardDeviation(s1) / Math.max(standardDeviation(s2), 1e-6);
    if (!Number.isFinite(alpha)) continue;
    const windowSignal = detrend(s1.map((value, index) => value + alpha * s2[index]));
    windowSignal.forEach((value, offset) => {
      accumulated[start + offset] += value;
      counts[start + offset] += 1;
    });
  }
  return accumulated.map((value, index) => counts[index] ? value / counts[index] : 0).filter(Number.isFinite);
};

const findPeakIntervals = (signal: number[], sampleRate: number): number[] => {
  const mean = signal.reduce((sum, value) => sum + value, 0) / Math.max(1, signal.length);
  const deviation = Math.sqrt(signal.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, signal.length));
  const threshold = mean + deviation * 0.2;
  const minimumGap = Math.floor(sampleRate * 60 / 180);
  const peaks: number[] = [];
  for (let index = 1; index < signal.length - 1; index++) {
    if (signal[index] <= threshold || signal[index] <= signal[index - 1] || signal[index] < signal[index + 1]) continue;
    const previous = peaks[peaks.length - 1];
    if (previous === undefined || index - previous >= minimumGap) peaks.push(index);
    else if (signal[index] > signal[previous]) peaks[peaks.length - 1] = index;
  }
  return peaks.slice(1).map((peak, index) => (peak - peaks[index]) / sampleRate).filter((interval) => interval >= 1 / 3 && interval <= 1.5);
};

const analyzeRppg = (samples: RgbSample[]): ScanResult => {
  const reasons: ScanResult['reasons'] = {};
  const timestamp = new Date().toISOString();
  const unavailable = (message: string): ScanResult => ({ quality: null, qualityLabel: 'Unavailable', qualityReason: message, reasons: { heartRate: message, breathingRate: message, hrv: message, stressLevel: 'HRV could not be measured.' }, timestamp });
  const usableSamples = resampleAt30Hz(samples);
  const rawChannelRange = (key: 'red' | 'green' | 'blue') => ({
    min: Math.min(...samples.map((sample) => sample[key])),
    max: Math.max(...samples.map((sample) => sample[key])),
  });
  const usableSeconds = samples.length > 1 ? (samples[samples.length - 1].time - samples[0].time) / 1000 : 0;
  const averageFps = usableSeconds > 0 ? (samples.length - 1) / usableSeconds : 0;
  const minimumDataSeconds = 20;
  const minimumSampleCount = minimumDataSeconds * 30;
  const sampleRate = 30;
  const pos = detrend(slidingPosSignal(usableSamples, sampleRate));
  const pulse = filterBiquad(filterBiquad(pos, sampleRate, 0.7, true), sampleRate, 3, false);
  const signalRange = (values: number[]) => values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: null, max: null };
  if (import.meta.env.DEV) console.log('[Vitals scan diagnostics]', {
    samplesCollected: samples.length,
    resampledSamples: usableSamples.length,
    usableDurationSeconds: usableSeconds,
    averageFps,
    redRawRange: samples.length ? rawChannelRange('red') : null,
    greenRawRange: samples.length ? rawChannelRange('green') : null,
    blueRawRange: samples.length ? rawChannelRange('blue') : null,
    bandPassedPulseSignal: signalRange(pulse),
  });
  if (!Number.isFinite(averageFps) || averageFps < minimumCaptureFps) return unavailable(`Only ${Number.isFinite(averageFps) ? averageFps.toFixed(1) : '0.0'} fps captured. Close other tabs and retry; at least ${minimumCaptureFps} fps is required.`);
  if (!Number.isFinite(usableSeconds) || usableSeconds < minimumDataSeconds || usableSamples.length < minimumSampleCount) {
    const collectedSeconds = Math.min(Math.max(usableSeconds, 0), usableSamples.length / 30);
    return unavailable(`Only ${collectedSeconds.toFixed(1)} seconds of usable signal were captured. At least 20 seconds are required; keep your face in view and retry.`);
  }

  const pulseSpectrum = spectrumPeak(pulse, sampleRate, 0.7, 3);
  const peakIntervals = findPeakIntervals(pulse, sampleRate);
  const breathingSignal = filterBiquad(filterBiquad(pos, sampleRate, 0.1, true), sampleRate, 0.5, false);
  const breathingSpectrum = spectrumPeak(breathingSignal, sampleRate, 0.1, 0.5);
  const motion = usableSamples.reduce((sum, sample) => sum + sample.motion, 0) / usableSamples.length;
  const brightness = usableSamples.reduce((sum, sample) => sum + sample.brightness, 0) / usableSamples.length;
  if (!pulseSpectrum || !Number.isFinite(motion) || !Number.isFinite(brightness)) return unavailable('Signal quality could not be computed from this scan.');

  const qualityValue = clamp((clamp((pulseSpectrum.snrDb + 2) / 18, 0, 1) * 0.55)
    + (clamp(1 - motion / 0.06, 0, 1) * 0.3)
    + (clamp((brightness - 10) / 100, 0, 1) * 0.15), 0, 1);
  if (!Number.isFinite(qualityValue)) return unavailable('Signal quality could not be computed from this scan.');
  const qualityLabel: QualityLabel = qualityValue >= 0.68 ? 'Good' : qualityValue >= 0.4 ? 'Low' : 'Poor';
  const quality = qualityValue;
  const heartRateEstimate = Math.round(pulseSpectrum.frequency * 60);
  const heartRate = quality !== null && Number.isFinite(heartRateEstimate) && heartRateEstimate >= 42 && heartRateEstimate <= 180 ? heartRateEstimate : undefined;
  const breathingEstimate = breathingSpectrum ? Math.round(breathingSpectrum.frequency * 60) : undefined;
  const breathingRate = quality !== null && breathingSpectrum && breathingEstimate !== undefined && Number.isFinite(breathingEstimate) && breathingEstimate >= 6 && breathingEstimate <= 30 ? breathingEstimate : undefined;

  const rmssd = peakIntervals.length >= 10
    ? Math.sqrt(peakIntervals.slice(1).reduce((sum, interval, index) => sum + ((interval - peakIntervals[index]) * 1000) ** 2, 0) / (peakIntervals.length - 1))
    : undefined;
  const qualityReason = motion > 0.035 ? 'Movement reduced signal quality.' : brightness < 35 ? 'Low lighting reduced signal quality.' : qualityLabel !== 'Good' ? 'The pulse signal was weak or noisy.' : undefined;

  if (heartRate === undefined) reasons.heartRate = qualityLabel === 'Poor' ? 'Signal quality was too low to report heart rate.' : 'A clear pulse peak was not found in the camera signal.';
  if (breathingRate === undefined) reasons.breathingRate = qualityLabel === 'Poor' ? 'Signal quality was too low to report breathing rate.' : 'A clear breathing rhythm was not found in the camera signal.';
  if (rmssd === undefined || qualityLabel !== 'Good' || !Number.isFinite(rmssd)) reasons.hrv = 'HRV requires a clean pulse signal with enough detected beats.';
  if (rmssd !== undefined && qualityLabel === 'Good') reasons.stressLevel = 'Experimental inverse-RMSSD proxy; not a validated stress measure.';
  const stressLevel = rmssd !== undefined && Number.isFinite(rmssd) && qualityLabel === 'Good' ? Math.round(clamp(100 - rmssd, 0, 100)) : undefined;
  return {
    heartRate, breathingRate,
    ...(rmssd !== undefined && Number.isFinite(rmssd) && qualityLabel === 'Good' ? { hrv: Math.round(rmssd) } : {}),
    ...(stressLevel !== undefined ? { stressLevel } : {}),
    quality, qualityLabel, qualityReason, reasons, timestamp: new Date().toISOString(),
  };
};

const waitForCameraFrame = (video: HTMLVideoElement): Promise<number> => new Promise((resolve) => {
  const videoWithFrameCallback = video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: (now: number) => void) => number };
  if (videoWithFrameCallback.requestVideoFrameCallback) videoWithFrameCallback.requestVideoFrameCallback((now) => resolve(now));
  else requestAnimationFrame((now) => resolve(now));
});

export const VitalsRecordPage: React.FC = () => {
  const isPatient = useAuthStore((state) => state.user?.role?.toLowerCase() === 'patient');
  const [history, setHistory] = useState<ScanHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const stopRequestedRef = useRef(false);
  useFadeUp(containerRef);

  const stopCamera = useCallback(() => {
    stopRequestedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current?.close();
    detectorRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    api.get('/vitals/mine', { skipToast: true }).then((response: unknown) => {
      const body = response as { success?: boolean; data?: unknown };
      if (body.success !== true || !Array.isArray(body.data)) throw new Error('The saved scan history response was invalid.');
      const records = body.data as ScanHistoryRecord[];
      if (records.some((record) => !record || typeof record.vitalsId !== 'string' || typeof record.recordedAt !== 'string')) {
        throw new Error('The saved scan history contains an invalid record.');
      }
      if (active) setHistory(records);
    }).catch((error: unknown) => {
      if (active) setHistoryError(error instanceof Error ? error.message : 'Could not load your saved scan history.');
    }).finally(() => {
      if (active) setHistoryLoading(false);
    });
    return () => { active = false; };
  }, [refreshKey]);

  const runScan = async (consentConfirmed = consent) => {
    setScanError(null);
    setScanNotice(null);
    setResult(null);
    setSaved(false);
    if (!consentConfirmed) return setScanError('Consent is required before the camera scan can start.');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return setScanError('Camera access requires localhost or HTTPS and a browser with camera support.');
    }

    stopRequestedRef.current = false;
    setCameraStarting(true);
    setModelLoading(false);
    setScanStatus('Opening camera…');
    setProgress(0);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('The camera preview could not be initialized.');
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);
      setCameraStarting(false);
      setModelLoading(true);
      setScanStatus('Loading the local face model…');
      if (!detectorRef.current) {
        try {
          const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe`);
          detectorRef.current = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.4,
            minFacePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(`Could not load the local face model or WASM runtime: ${detail}`);
        }
      }
      const landmarker = detectorRef.current;
      if (!landmarker) throw new Error('The local face model did not initialize. Retry the scan.');
      setModelLoading(false);
      setScanRunning(true);
      setScanStatus('Center your face and hold still to begin.');

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The browser could not initialize local camera analysis.');

      const patchSize = 24;
      const roiCanvas = document.createElement('canvas');
      roiCanvas.width = patchSize * 3;
      roiCanvas.height = patchSize;
      const roiContext = roiCanvas.getContext('2d', { willReadFrequently: true });
      if (!roiContext) throw new Error('The browser could not initialize local skin-region analysis.');

      const sampleCapacity = 8192;
      const sampleTimes = new Float64Array(sampleCapacity);
      const sampleCameraTimes = new Float64Array(sampleCapacity);
      const sampleRed = new Float64Array(sampleCapacity);
      const sampleGreen = new Float64Array(sampleCapacity);
      const sampleBlue = new Float64Array(sampleCapacity);
      const sampleMotion = new Float64Array(sampleCapacity);
      const sampleBrightness = new Float64Array(sampleCapacity);
      const pointX = new Float64Array(3);
      const pointY = new Float64Array(3);
      const pixelSlotX = new Int32Array(3);
      pixelSlotX[0] = 0; pixelSlotX[1] = patchSize; pixelSlotX[2] = patchSize * 2;
      let sampleCount = 0;
      let measuredTime = 0;
      let lastActiveFrameTime = 0;
      let previousFaceCenterX: number | null = null;
      let previousFaceCenterY: number | null = null;
      let faceLostAt: number | null = null;
      let pausedMilliseconds = 0;
      let lastFaceDetectedAt = 0;
      let facePointsValid = false;
      let faceCenterX = 0;
      let faceCenterY = 0;
      let frameMotion = 0;
      let reacquireFrames = 5;
      let frameNumber = 0;
      let lastUiUpdateAt = 0;
      let currentNotice: string | null = null;
      const scanStartedAt = performance.now();
      let totalFrameProcessingMs = 0;
      let maxFrameProcessingMs = 0;
      let detectorCalls = 0;
      let detectorProcessingMs = 0;
      let maxDetectorMs = 0;
      let pixelReadCalls = 0;
      let pixelReadMs = 0;
      let maxPixelReadMs = 0;
      let signalProcessingMs = 0;
      let maxSignalProcessingMs = 0;
      let usableFrameCount = 0;
      const publishNotice = (notice: string | null) => {
        if (notice !== currentNotice) {
          currentNotice = notice;
          setScanNotice(notice);
        }
      };

      while (measuredTime < scanDurationSeconds * 1000 && !stopRequestedRef.current) {
        const now = await waitForCameraFrame(video);
        const frameProcessingStarted = performance.now();
        frameNumber += 1;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          publishNotice('Camera not ready. Waiting for a video frame.');
          continue;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        let detectorMs = 0;
        if (frameNumber % 4 === 0) {
          const detectorStart = performance.now();
          const faceLandmarks = landmarker.detectForVideo(video, now).faceLandmarks[0];
          detectorMs = performance.now() - detectorStart;
          detectorCalls += 1;
          detectorProcessingMs += detectorMs;
          maxDetectorMs = Math.max(maxDetectorMs, detectorMs);
          facePointsValid = Boolean(faceLandmarks && faceLandmarks.length >= 347);
          if (facePointsValid && faceLandmarks) {
            let minX = 1; let maxX = 0; let minY = 1; let maxY = 0;
            for (let index = 0; index < faceLandmarks.length; index++) {
              const point = faceLandmarks[index];
              minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
              minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
            }
            if ((maxX - minX) * (maxY - minY) < 0.1) facePointsValid = false;
            const topX = faceLandmarks[10].x * canvas.width; const topY = faceLandmarks[10].y * canvas.height;
            const centerForeheadX = faceLandmarks[168].x * canvas.width; const centerForeheadY = faceLandmarks[168].y * canvas.height;
            pointX[0] = topX + (centerForeheadX - topX) * 0.45;
            pointY[0] = topY + (centerForeheadY - topY) * 0.45;
            pointX[1] = faceLandmarks[117].x * canvas.width; pointY[1] = faceLandmarks[117].y * canvas.height;
            pointX[2] = faceLandmarks[346].x * canvas.width; pointY[2] = faceLandmarks[346].y * canvas.height;
            faceCenterX = (minX + maxX) / 2; faceCenterY = (minY + maxY) / 2;
            frameMotion = previousFaceCenterX === null || previousFaceCenterY === null ? 0 : Math.hypot(faceCenterX - previousFaceCenterX, faceCenterY - previousFaceCenterY);
            previousFaceCenterX = faceCenterX; previousFaceCenterY = faceCenterY;
            lastFaceDetectedAt = now;
          }
          if (!facePointsValid) {
            if (faceLostAt === null) faceLostAt = lastFaceDetectedAt || now;
            previousFaceCenterX = null; previousFaceCenterY = null;
          } else if (faceLostAt !== null) {
            pausedMilliseconds += Math.max(0, now - faceLostAt);
            faceLostAt = null;
            lastActiveFrameTime = now;
            reacquireFrames = 2;
          }
        }

        if (!facePointsValid) {
          if (faceLostAt !== null && now - faceLostAt >= 1500) publishNotice('Face not clearly visible. Adjust your position and lighting.');
        } else if (reacquireFrames > 0) {
          reacquireFrames -= 1;
          if (reacquireFrames === 0) {
            lastActiveFrameTime = now;
            publishNotice(null);
            setScanStatus('Scan in progress');
          }
        } else {
          const movement = frameMotion;
          const signalStart = performance.now();
          for (let slot = 0; slot < 3; slot++) {
            const sourceX = Math.max(0, Math.min(canvas.width - patchSize, Math.round(pointX[slot] - patchSize / 2)));
            const sourceY = Math.max(0, Math.min(canvas.height - patchSize, Math.round(pointY[slot] - patchSize / 2)));
            roiContext.drawImage(canvas, sourceX, sourceY, patchSize, patchSize, pixelSlotX[slot], 0, patchSize, patchSize);
          }
          const readStart = performance.now();
          const roiPixels = roiContext.getImageData(0, 0, roiCanvas.width, roiCanvas.height).data;
          const readMs = performance.now() - readStart;
          pixelReadCalls += 1; pixelReadMs += readMs; maxPixelReadMs = Math.max(maxPixelReadMs, readMs);
          let red = 0; let green = 0; let blue = 0; let brightness = 0; let pixelCount = 0;
          for (let offset = 0; offset < roiPixels.length; offset += 4) {
            red += roiPixels[offset]; green += roiPixels[offset + 1]; blue += roiPixels[offset + 2];
            brightness += (roiPixels[offset] + roiPixels[offset + 1] + roiPixels[offset + 2]) / 3;
            pixelCount += 1;
          }
          const averageBrightness = brightness / pixelCount;
          const activeDelta = lastActiveFrameTime ? Math.max(now - lastActiveFrameTime, 1) : 0;
          if (activeDelta > 0 && sampleCount < sampleCapacity) {
            measuredTime += activeDelta;
            sampleTimes[sampleCount] = measuredTime;
            sampleCameraTimes[sampleCount] = now;
            sampleRed[sampleCount] = red / pixelCount;
            sampleGreen[sampleCount] = green / pixelCount;
            sampleBlue[sampleCount] = blue / pixelCount;
            sampleMotion[sampleCount] = movement;
            sampleBrightness[sampleCount] = averageBrightness;
            sampleCount += 1;
            usableFrameCount += 1;
          }
          lastActiveFrameTime = now;
          const signalMs = performance.now() - signalStart;
          signalProcessingMs += signalMs; maxSignalProcessingMs = Math.max(maxSignalProcessingMs, signalMs);
          publishNotice(averageBrightness < 35 ? 'Lighting is low. The scan will continue, but signal quality may be reduced.' : null);
        }

        const totalFrameMs = performance.now() - frameProcessingStarted;
        totalFrameProcessingMs += totalFrameMs;
        maxFrameProcessingMs = Math.max(maxFrameProcessingMs, totalFrameMs);
        if (lastUiUpdateAt === 0 || now - lastUiUpdateAt >= 250) {
          setProgress(Math.min(100, Math.round(measuredTime / (scanDurationSeconds * 1000) * 100)));
          lastUiUpdateAt = now;
        }
      }

      if (stopRequestedRef.current) throw new Error('Scan cancelled. You can retry when ready.');
      if (faceLostAt !== null) pausedMilliseconds += Math.max(0, performance.now() - faceLostAt);
      const samples: RgbSample[] = new Array(sampleCount);
      for (let index = 0; index < sampleCount; index++) {
        samples[index] = { time: sampleTimes[index], cameraTimestamp: sampleCameraTimes[index], red: sampleRed[index], green: sampleGreen[index], blue: sampleBlue[index], motion: sampleMotion[index], brightness: sampleBrightness[index] };
      }
      const analysisStartedAt = performance.now();
      const analysis = analyzeRppg(samples);
      if (import.meta.env.DEV) console.log('[Vitals scan performance]', {
        sampledFrames: sampleCount,
        loopFrames: frameNumber,
        scanActiveSeconds: measuredTime / 1000,
        wallSeconds: (performance.now() - scanStartedAt) / 1000,
        faceLostPausedSeconds: pausedMilliseconds / 1000,
        averageCameraFps: measuredTime > 0 ? Math.max(0, sampleCount - 1) / (measuredTime / 1000) : 0,
        detectorCalls,
        detectorAverageMs: detectorCalls ? detectorProcessingMs / detectorCalls : 0,
        detectorMaxMs: maxDetectorMs,
        getImageDataCalls: pixelReadCalls,
        getImageDataAverageMs: pixelReadCalls ? pixelReadMs / pixelReadCalls : 0,
        getImageDataMaxMs: maxPixelReadMs,
        signalAverageMs: usableFrameCount ? signalProcessingMs / usableFrameCount : 0,
        signalMaxMs: maxSignalProcessingMs,
        frameAverageMs: frameNumber ? totalFrameProcessingMs / frameNumber : 0,
        frameMaxMs: maxFrameProcessingMs,
        analysisMs: performance.now() - analysisStartedAt,
      });
      setResult(analysis);
      setScanNotice(null);
      setProgress(100);
    } catch (error) {
      const cameraError = error as { name?: string; message?: string };
      const message = cameraError.name === 'NotAllowedError' || cameraError.name === 'PermissionDeniedError'
        ? 'Camera permission was denied. Allow Camera from the browser address bar, then retry.'
        : cameraError.name === 'NotFoundError' || cameraError.name === 'DevicesNotFoundError'
          ? 'No camera is available. Connect or enable a camera, then retry.'
          : cameraError.name === 'NotReadableError'
            ? 'The camera is in use or unavailable. Close other apps or tabs using it, then retry.'
            : cameraError.message || 'The scan failed. Check the camera and retry.';
      setScanError(message);
      setResult(null);
    } finally {
      setScanRunning(false);
      setCameraStarting(false);
      setModelLoading(false);
      setScanStatus('');
      stopCamera();
    }
  };
  const saveResult = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const response = await api.post('/vitals/scan', {
        selectedMetrics: storedMetrics,
        ...(result.heartRate !== undefined ? { heartRate: result.heartRate } : {}),
        ...(result.breathingRate !== undefined ? { breathingRate: result.breathingRate } : {}),
        ...(result.hrv !== undefined ? { hrv: result.hrv } : {}),
        ...(result.stressLevel !== undefined ? { stressLevel: result.stressLevel } : {}),
        scanDuration: scanDurationSeconds,
        ...(result.quality !== null ? { quality: result.quality, confidence: result.quality } : {}),
      }, { skipToast: true }) as { success?: boolean };
      if (response.success !== true) throw new Error('The vitals service did not confirm that the scan was saved.');
      setSaved(true);
      setRefreshKey((key) => key + 1);
      toast.success('Vitals scan saved to your scan history.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the vitals scan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div ref={containerRef} className="face-vitals-page space-y-6">
        <div className="face-vitals-shell">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Secure Clinical Workflow</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-textPrimary">AI Optical Vitals Scan</h1>
              <p className="text-sm text-textSecondary mt-1">Real-time rPPG camera telemetry analysis and recorded history.</p>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-surface border border-border text-textPrimary shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Camera Sensor Ready</span>
            </span>
          </header>

          {/* Pre-scan advisory card */}
          <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-base font-bold text-textPrimary flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              <span>Before You Start</span>
            </h2>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm text-textSecondary font-medium">
              <li className="flex items-center gap-2 bg-background/60 p-3 rounded-xl border border-border/40">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Ensure bright, uniform face lighting.</span>
              </li>
              <li className="flex items-center gap-2 bg-background/60 p-3 rounded-xl border border-border/40">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Position device directly at eye level.</span>
              </li>
              <li className="flex items-center gap-2 bg-background/60 p-3 rounded-xl border border-border/40">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Remain calm and minimize head motion.</span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-textSecondary leading-relaxed">
              * Biometric analysis executes entirely inside your local browser runtime. Video frames never leave this workstation.
            </p>
            {!scanPanelOpen && (
              <button
                type="button"
                onClick={() => { setScanError(null); setResult(null); setSaved(false); setConsent(false); setScanPanelOpen(true); }}
                disabled={scanRunning || cameraStarting}
                className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-primary to-teal-600 hover:from-primary-hover hover:to-teal-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <ScanLine className="w-4 h-4" aria-hidden="true" />
                <span>Initialize Camera Scan</span>
              </button>
            )}
          </div>

          {/* Active scan preview viewport */}
          {scanPanelOpen && !result && (
            <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-sm mb-6">
              <div className="mb-4">
                <h3 className="text-base font-bold text-textPrimary">Biometric Telemetry HUD</h3>
                <p className="text-xs text-textSecondary mt-0.5">Maintain steady focus while the neural landmark detector measures blood flow micro-shifts.</p>
              </div>

              <div className="border-t border-border/60 pt-4">
                <label className="mb-4 flex items-start gap-3 text-xs sm:text-sm text-textPrimary cursor-pointer bg-background/60 p-3 rounded-xl border border-border/40">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => { const checked = event.target.checked; setConsent(checked); if (checked) void runScan(true); }}
                    disabled={scanRunning || cameraActive || cameraStarting}
                    className="mt-0.5 rounded text-primary focus:ring-primary"
                  />
                  <span>I agree to a local camera scan. Raw frames are processed in-memory and are never transmitted to external servers.</span>
                </label>

                <div className="relative mb-4 overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    aria-label="Live face scan preview"
                    className={`aspect-video max-h-96 w-full object-cover ${cameraActive ? '' : 'hidden'}`}
                  />
                  {!cameraActive && (
                    <div className="flex aspect-video max-h-96 items-center justify-center text-sm font-semibold text-slate-400">
                      Sensor Standby — Check consent above to start camera
                    </div>
                  )}
                </div>

                {(modelLoading || scanStatus) && (
                  <p role="status" className="mb-3 text-xs font-semibold text-textSecondary animate-pulse">
                    {scanStatus}
                  </p>
                )}

                {scanRunning && (
                  <div className="mb-4 bg-background/80 p-3.5 rounded-xl border border-border/60" role="status">
                    <div className="mb-2 flex justify-between text-xs font-bold text-textPrimary">
                      <span>{scanStatus || 'Analyzing optical telemetry locally…'}</span>
                      <span className="text-primary font-mono">{Math.floor(progress * scanDurationSeconds / 100)}s / {scanDurationSeconds}s</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-teal-500 rounded-full transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {scanNotice && (
                  <div role="status" className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>{scanNotice}</span>
                  </div>
                )}

                {scanError && (
                  <div role="alert" className="mb-4 p-3 bg-danger/10 border border-danger/20 text-danger rounded-xl text-xs font-semibold">
                    {scanError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {!consent && (
                    <p className="text-xs text-textSecondary font-medium">Consent is required to activate the camera sensor.</p>
                  )}
                  {scanError && consent && !scanRunning && (
                    <button
                      type="button"
                      onClick={() => void runScan(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm transition-all"
                    >
                      <Video className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Retry Scan</span>
                    </button>
                  )}
                  {cameraStarting && (
                    <span role="status" className="text-xs font-semibold text-textSecondary">
                      Calibrating camera sensor…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={stopCamera}
                    disabled={!scanRunning && !cameraActive && !cameraStarting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-textPrimary bg-background border border-border hover:bg-surface rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    <VideoOff className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Stop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { stopCamera(); setScanPanelOpen(false); }}
                    disabled={scanRunning}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary bg-transparent rounded-xl transition-all disabled:opacity-50"
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Telemetry Result Overview */}
          {result && (
            <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-border/40">
                <h3 className="text-lg font-bold text-textPrimary">Biometric Telemetry Results</h3>
                <span className="text-xs font-medium text-textSecondary font-mono">
                  {new Date(result.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { key: 'heartRate', title: 'Heart Rate', value: result.heartRate === undefined ? 'Could not measure' : `${result.heartRate} bpm` },
                  { key: 'breathingRate', title: 'Breathing Rate', value: result.breathingRate === undefined ? 'Could not measure' : `${result.breathingRate} br/min` },
                  { key: 'hrv', title: 'HRV (RMSSD)', value: result.hrv === undefined ? 'Could not measure' : `${result.hrv} ms` },
                  { key: 'stressLevel', title: 'Stress Index', value: result.stressLevel === undefined ? 'Could not measure' : `${result.stressLevel} / 100` },
                ].filter(({ key }) => (key !== 'hrv' && key !== 'stressLevel') || result.qualityLabel === 'Good').map(({ key, title, value }) => (
                  <div key={key} className="rounded-xl border border-border/80 bg-background/70 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-textSecondary">{title}</p>
                    <p className="mt-1 text-2xl font-extrabold text-textPrimary tracking-tight">{value}</p>
                    {result.reasons[key as keyof ScanResult['reasons']] && (
                      <p className="mt-2 text-[11px] text-textSecondary font-medium">{result.reasons[key as keyof ScanResult['reasons']]}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3.5 rounded-xl bg-background/50 border border-border/50 text-xs text-textSecondary space-y-1">
                <p>
                  Measurement Quality: <strong className="text-textPrimary">{result.qualityLabel}</strong>
                  {result.quality !== null && ` (${Math.round(result.quality * 100)}% accuracy score)`}
                  {result.qualityLabel === 'Low' && <span className="ml-2 font-bold text-warning">Low Confidence</span>}
                </p>
                {result.qualityReason && <p>{result.qualityReason}</p>}
                <p className="text-[11px] text-textSecondary/70 pt-1">* Values are estimated for wellness tracking and do not constitute formal diagnostic confirmation.</p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!saved && (
                  <button
                    type="button"
                    onClick={() => void saveResult()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-teal-600 hover:from-primary-hover hover:to-teal-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save To Scan History'}
                  </button>
                )}
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Saved To Clinical Scan History</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setResult(null); setScanError(null); setScanNotice(null); setSaved(false); setProgress(0); setConsent(false); setScanPanelOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-textPrimary bg-background border border-border hover:bg-surface rounded-xl shadow-sm transition-all"
                >
                  <span>Scan Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('vitals-history')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary rounded-xl transition-all"
                >
                  <span>View History</span>
                </button>
              </div>
            </div>
          )}

          {/* Historical scans section */}
          <section id="vitals-history" className="face-vitals-history mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-2 border-b border-border/40">
              <div>
                <h2 className="text-xl font-extrabold text-textPrimary tracking-tight">Recent Optical Scans</h2>
                <p className="text-xs text-textSecondary mt-0.5">Historical wellness and telemetry recordings.</p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                disabled={historyLoading}
                aria-label="Refresh scan history"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-textPrimary bg-surface border border-border hover:bg-background rounded-xl shadow-sm transition-all disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-primary ${historyLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>Refresh Feed</span>
              </button>
            </div>

            {historyLoading && (
              <div className="py-12 text-center bg-surface border border-border/50 rounded-2xl text-xs text-textSecondary font-medium">
                Loading telemetry logs…
              </div>
            )}
            {!historyLoading && historyError && (
              <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-xs font-medium">
                {historyError}
              </div>
            )}
            {!historyLoading && !historyError && history.length === 0 && (
              <div className="py-12 text-center bg-surface border border-dashed border-border rounded-2xl text-xs text-textSecondary">
                {isPatient ? 'No personal vitals recorded yet.' : 'No scans on record yet.'}
              </div>
            )}

            {!historyLoading && !historyError && history.length > 0 && (
              <div className="space-y-3">
                {history.map((record) => (
                  <div key={record.vitalsId} className="bg-surface border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40 text-xs mb-3">
                      <span className="flex items-center gap-1.5 font-medium text-textSecondary">
                        <Clock3 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        {new Date(record.recordedAt).toLocaleString()}
                      </span>
                      <span className="font-bold px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary">
                        {record.quality !== undefined ? `${Math.round(record.quality * 100)}% quality` : 'Telemetry Log'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {record.selectedMetrics?.includes('heartRate') && (
                        <div className="bg-background/80 p-2.5 rounded-xl border border-border/50">
                          <span className="text-[10px] uppercase font-bold text-textSecondary block">Heart Rate</span>
                          <strong className="text-sm font-extrabold text-textPrimary mt-0.5 block">{record.heartRate !== undefined ? `${record.heartRate} bpm` : '—'}</strong>
                        </div>
                      )}
                      {record.selectedMetrics?.includes('breathingRate') && (
                        <div className="bg-background/80 p-2.5 rounded-xl border border-border/50">
                          <span className="text-[10px] uppercase font-bold text-textSecondary block">Breathing Rate</span>
                          <strong className="text-sm font-extrabold text-textPrimary mt-0.5 block">{record.breathingRate !== undefined ? `${record.breathingRate} br/min` : '—'}</strong>
                        </div>
                      )}
                      {record.selectedMetrics?.includes('hrv') && (
                        <div className="bg-background/80 p-2.5 rounded-xl border border-border/50">
                          <span className="text-[10px] uppercase font-bold text-textSecondary block">HRV RMSSD</span>
                          <strong className="text-sm font-extrabold text-textPrimary mt-0.5 block">{record.hrv !== undefined ? `${record.hrv} ms` : '—'}</strong>
                        </div>
                      )}
                      {record.selectedMetrics?.includes('stressLevel') && (
                        <div className="bg-background/80 p-2.5 rounded-xl border border-border/50">
                          <span className="text-[10px] uppercase font-bold text-textSecondary block">Stress Score</span>
                          <strong className="text-sm font-extrabold text-textPrimary mt-0.5 block">{record.stressLevel !== undefined ? `${record.stressLevel}/100` : '—'}</strong>
                        </div>
                      )}
                    </div>

                    {record.analysis?.message && (
                      <p className="mt-2.5 text-xs text-textSecondary font-medium">{record.analysis.message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};
