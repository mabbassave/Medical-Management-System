import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw, Scan, ShieldAlert, X } from 'lucide-react';
import './FaceScanModal.css';

interface FaceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'enrollment' | 'login';
  onEnrollmentCapture?: (image: Blob) => Promise<void>;
  onFaceVerification?: (image: Blob) => Promise<void>;
  onVerificationComplete?: () => void;
  captureOnly?: boolean;
  captureDisabled?: boolean;
}

type ScanStage = 'idle' | 'initializing' | 'ready' | 'capturing' | 'failed' | 'captured' | 'enrolled' | 'verified';

const waitForVideoReady = (video: HTMLVideoElement, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const isReady = () =>
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0;
    let timeout: number;

    const cleanup = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => {
      if (!isReady()) return;
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('The camera connected, but the video preview could not be started.'));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Camera preview was cancelled.', 'AbortError'));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    if (isReady()) {
      resolve();
      return;
    }

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('playing', onReady);
    video.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('The camera connected, but no video became available. Close other apps using the camera, then retry.'));
    }, 5000);
  });

const getCameraErrorMessage = (error: unknown, phase: 'access' | 'preview') => {
  const name = error instanceof Error ? error.name : '';

  if (name === 'InsecureContextError') {
    return 'Camera access requires a secure HTTPS connection or localhost.';
  }
  if (name === 'UnsupportedError') {
    return 'Camera access is not supported by this browser. Try a current browser with camera support.';
  }
  if (phase === 'access') {
    if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) {
      return 'Camera permission was denied or blocked. Allow camera access for this site in your browser and device settings, then retry.';
    }
    if (['NotFoundError', 'DevicesNotFoundError'].includes(name)) {
      return 'No camera was found on this device. Connect or enable a camera, then retry.';
    }
    if (name === 'NotReadableError') {
      return 'The camera could not be opened. Close other apps using it and check your device camera settings, then retry.';
    }
    if (name === 'AbortError') {
      return 'Camera startup was interrupted. Check that the camera is available, then retry.';
    }
    if (name === 'OverconstrainedError') {
      return 'No available camera can provide a compatible video preview.';
    }
    return 'Unable to access the camera. Check browser permissions and that a camera is connected, then retry.';
  }

  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) {
    return 'The camera opened, but the browser blocked video playback. Allow camera access and retry.';
  }
  if (name === 'NotReadableError') {
    return 'The camera preview stopped unexpectedly. Close other apps using the camera and retry.';
  }
  return error instanceof Error
    ? error.message
    : 'The camera preview could not be started. Check camera access and retry.';
};

const getRetryAfterSeconds = (error: unknown): number => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return 0;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return 0;
  const data = response.data;
  if (typeof data !== 'object' || data === null || !('retryAfterSeconds' in data)) return 0;
  const seconds = data.retryAfterSeconds;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : 0;
};

const getVerificationErrorMessage = (error: unknown): string => {
  const requestError = error as {
    code?: string;
    message?: string;
    response?: {
      status?: number;
      data?: { diagnosticCode?: string };
    };
  } | null;
  const status = requestError?.response?.status;
  const diagnosticCode = requestError?.response?.data?.diagnosticCode;

  if (
    status === 409
    || diagnosticCode === 'NO_ELIGIBLE_ENROLLMENT'
    || diagnosticCode === 'FACE_TEMPLATE_MISSING'
  ) {
    return 'No eligible face enrollment is available for this sign-in. Use your password to sign in, then enroll or update your face from your account.';
  }
  if (status === 401 || diagnosticCode === 'FACE_MISMATCH') {
    return 'The camera image did not match an eligible face enrollment. Retry with your enrolled face or sign in with your password.';
  }
  if (status === 429) {
    return 'Too many verification attempts were made. Wait for the retry timer, then try again or use your password.';
  }
  if (requestError?.code === 'ECONNABORTED' || requestError?.message?.toLowerCase().includes('timeout')) {
    return 'Face verification timed out. No identity was confirmed. Retry when the service is available.';
  }
  if (status === 503 || (typeof status === 'number' && status >= 500)) {
    return 'Face verification is temporarily unavailable. No identity was confirmed. Please retry later or use your password.';
  }
  if (requestError?.code === 'ERR_NETWORK' || requestError?.message === 'Network Error') {
    return 'The verification service could not be reached. Check your connection and retry, or use your password.';
  }
  if (typeof status === 'number') {
    return 'Face verification could not be completed. Retry or use your password to sign in.';
  }
  return requestError?.message || 'Face verification could not be completed. Please retry.';
};

export const FaceScanModal: React.FC<FaceScanModalProps> = ({
  isOpen,
  onClose,
  mode,
  onEnrollmentCapture,
  onFaceVerification,
  onVerificationComplete,
  captureOnly = false,
  captureDisabled = false,
}) => {
  const [stage, setStage] = useState<ScanStage>('idle');
  const [failureReason, setFailureReason] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureInProgressRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const activeCameraRequestRef = useRef<number | null>(null);
  const cameraStartPromiseRef = useRef<Promise<MediaStream> | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const cameraTrackEndedHandlerRef = useRef<(() => void) | null>(null);
  const unavailableMessage = mode === 'login'
    ? 'Face sign-in is unavailable. Please sign in with your email and password.'
    : 'This enrollment session is not connected to an account. Please sign in or create an account, then retry.';

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    activeCameraRequestRef.current = null;
    cameraStartPromiseRef.current = null;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        if (cameraTrackEndedHandlerRef.current) {
          track.removeEventListener('ended', cameraTrackEndedHandlerRef.current);
        }
        track.stop();
      });
      streamRef.current = null;
    }
    cameraTrackEndedHandlerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleClose = () => {
    if (mode === 'login' && stage === 'verified') {
      onVerificationComplete?.();
      return;
    }
    stopCamera();
    setStage('idle');
    setFailureReason('');
    setConsentGiven(false);
    setRetryDelaySeconds(0);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      stopCamera();
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [isOpen, stopCamera]);

  useEffect(() => {
    if (retryDelaySeconds <= 0) return;
    const timer = window.setTimeout(
      () => setRetryDelaySeconds((seconds) => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [retryDelaySeconds]);

  const startCamera = async () => {
    if (activeCameraRequestRef.current !== null) return;
    if (!consentGiven || retryDelaySeconds > 0) return;

    const requestId = ++cameraRequestRef.current;
    activeCameraRequestRef.current = requestId;
    setFailureReason('');
    setStage('initializing');

    let phase: 'access' | 'preview' = 'access';
    try {
      if (!window.isSecureContext) {
        throw Object.assign(new Error('Camera access requires a secure HTTPS connection or localhost.'), {
          name: 'InsecureContextError',
        });
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('Camera access is not supported by this browser.'), {
          name: 'UnsupportedError',
        });
      }

      let cameraRequest = cameraStartPromiseRef.current;
      if (!cameraRequest) {
        cameraRequest = navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        cameraStartPromiseRef.current = cameraRequest;
      }

      let stream: MediaStream;
      try {
        stream = await cameraRequest;
      } finally {
        if (cameraStartPromiseRef.current === cameraRequest) {
          cameraStartPromiseRef.current = null;
        }
      }

      if (activeCameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0 || videoTracks.every((track) => track.readyState !== 'live')) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('The camera returned no live video track. Check that a camera is connected and enabled, then retry.');
      }

      streamRef.current = stream;
      const onCameraTrackEnded = () => {
        if (streamRef.current !== stream) return;
        activeCameraRequestRef.current = null;
        stream.getTracks().forEach((track) => {
          track.removeEventListener('ended', onCameraTrackEnded);
          track.stop();
        });
        streamRef.current = null;
        cameraTrackEndedHandlerRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setStage('failed');
        setFailureReason('The camera preview stopped unexpectedly. Close other apps using the camera and retry.');
      };
      cameraTrackEndedHandlerRef.current = onCameraTrackEnded;
      stream.getTracks().forEach((track) => track.addEventListener('ended', onCameraTrackEnded, { once: true }));
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => {
          track.removeEventListener('ended', onCameraTrackEnded);
          track.stop();
        });
        streamRef.current = null;
        cameraTrackEndedHandlerRef.current = null;
        throw new Error('The camera preview is not available. Close and reopen the preview, then retry.');
      }

      phase = 'preview';
      const abortController = new AbortController();
      previewAbortRef.current = abortController;
      video.srcObject = stream;
      await video.play();
      await waitForVideoReady(video, abortController.signal);

      if (activeCameraRequestRef.current === requestId) {
        if (stream.getVideoTracks().every((track) => track.readyState !== 'live')) {
          throw new Error('The camera stopped before a live preview became available. Check the camera and retry.');
        }
        activeCameraRequestRef.current = null;
        previewAbortRef.current = null;
        setStage('ready');
      }
    } catch (error: unknown) {
      if (activeCameraRequestRef.current !== requestId) return;
      activeCameraRequestRef.current = null;
      previewAbortRef.current?.abort();
      previewAbortRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          if (cameraTrackEndedHandlerRef.current) {
            track.removeEventListener('ended', cameraTrackEndedHandlerRef.current);
          }
          track.stop();
        });
        streamRef.current = null;
      }
      cameraTrackEndedHandlerRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setStage('failed');
      setFailureReason(getCameraErrorMessage(error, phase));
    }
  };

  const handleVerify = async () => {
    if (captureInProgressRef.current || retryDelaySeconds > 0) return;
    if (mode === 'enrollment' && captureDisabled) {
      setStage('failed');
      setFailureReason('Face enrollment is unavailable on this server. The camera preview works, but no frame will be submitted.');
      return;
    }
    if (!consentGiven) {
      setStage('failed');
      setFailureReason('Consent is required before sending a camera frame for biometric processing.');
      return;
    }

    const video = videoRef.current;
    if (!video || stage !== 'ready' || !video.videoWidth || !video.videoHeight) {
      setStage('failed');
      setFailureReason('The camera has not produced a usable frame. Please retry the camera preview.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setStage('failed');
      setFailureReason('A camera frame could not be captured. Please retry.');
      return;
    }

    captureInProgressRef.current = true;
    setStage('capturing');
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const capture = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!capture) throw new Error('A camera frame could not be captured. Please retry.');
      stopCamera();

      if (mode === 'enrollment') {
        if (!onEnrollmentCapture) throw new Error(unavailableMessage);
        await onEnrollmentCapture(capture);
        setFailureReason('');
        setStage(captureOnly ? 'captured' : 'enrolled');
      } else {
        if (!onFaceVerification) throw new Error(unavailableMessage);
        await onFaceVerification(capture);
        setFailureReason('');
        setStage('verified');
      }
    } catch (error: unknown) {
      const retryAfterSeconds = getRetryAfterSeconds(error);
      if (retryAfterSeconds) setRetryDelaySeconds(retryAfterSeconds);
      setStage('failed');
      setFailureReason(
        mode === 'login'
          ? getVerificationErrorMessage(error)
          : error instanceof Error
          ? error.message
            : 'Face enrollment could not be completed. Please retry.'
      );
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      stopCamera();
      captureInProgressRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="face-verification-heading"
      className="face-scan-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-md animate-fade-in sm:p-4"
    >
      <div className="face-scan-dialog relative flex w-full max-w-2xl flex-col rounded-3xl border border-[#56E8F2]/20 bg-[#071423] p-4 text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_30px_rgba(86,232,242,0.08)] sm:p-6">
        {/* Header */}
        <div className="face-scan-header flex shrink-0 items-start justify-between gap-4 border-b border-white/10 pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#56E8F2]" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-[#56E8F2]">
                Face {mode === 'login' ? 'sign-in' : 'registration'}
              </span>
            </div>
            <h2 id="face-verification-heading" className="text-lg font-bold tracking-tight text-white sm:text-2xl">
              {mode === 'login' ? 'Face sign-in' : 'Face registration'}
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/65 sm:text-sm">
              {mode === 'login'
                ? 'A camera frame is compared on the server with your enrolled face. This similarity check does not detect presentation attacks.'
                : captureOnly
                  ? 'Capture a camera frame now. It will only be submitted for enrollment after your account is created.'
                  : 'Medivanta processes the camera frame locally and stores an encrypted face template for your account. This does not verify legal identity or detect presentation attacks.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close face scan"
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56E8F2]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {(
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/70">
            <input
              type="checkbox"
              checked={consentGiven}
              disabled={stage === 'initializing' || stage === 'ready' || stage === 'capturing' || stage === 'captured' || stage === 'enrolled' || stage === 'verified'}
              onChange={(event) => {
                setConsentGiven(event.target.checked);
                if (!event.target.checked) {
                  stopCamera();
                  setFailureReason('');
                  setStage('idle');
                }
              }}
              className="mt-0.5 accent-[#56E8F2]"
            />
            <span>
              {mode === 'login'
                ? 'I consent to sending this camera frame to Medivanta’s local face service to compare it with my encrypted face template. The camera image is processed in memory and is not stored. This check does not detect presentation attacks.'
                : captureOnly
                  ? 'I consent to capturing a camera frame in this browser and submitting it for server-side face enrollment after account registration. The frame is not uploaded unless account creation succeeds.'
                  : 'I consent to sending this camera frame to Medivanta’s local face service to create an encrypted face template for my account. The camera image is processed in memory and is not stored. This does not detect presentation attacks.'}
            </span>
          </label>
        )}

        {mode === 'enrollment' && captureDisabled && (
          <p role="status" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
            Camera preview is available, but face enrollment is disabled by the server. No frame will be submitted.
          </p>
        )}

        {/* Viewport Container */}
        <div className="face-scan-preview-wrap">
          <div
            className="face-scan-viewport relative mx-auto overflow-hidden rounded-2xl border border-[#56E8F2]/30 bg-[#06111D] shadow-[0_0_30px_rgba(86,232,242,0.12)]"
            aria-busy={stage === 'initializing' || stage === 'capturing'}
          >
            {/* Live Video Preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                stage === 'ready' || stage === 'capturing'
                  ? 'opacity-100'
                  : 'pointer-events-none absolute inset-0 opacity-0'
              }`}
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Technical grid backdrop (when camera is not active) */}
            {stage !== 'ready' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: `radial-gradient(rgba(86,232,242,0.4) 1px, transparent 1px)`,
                    backgroundSize: '20px 20px',
                  }}
                  aria-hidden="true"
                />

                {stage === 'idle' && (
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#56E8F2]/30 bg-[#56E8F2]/10 text-[#56E8F2] shadow-[0_0_24px_rgba(86,232,242,0.2)]">
                      <Camera className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-semibold text-white">Live Camera Preview</p>
                    <p className="mt-1 max-w-xs text-xs text-white/55">
                      {mode === 'login'
                        ? 'After you consent, one camera frame is sent to the server to compare with your enrolled face.'
                        : captureOnly
                          ? 'After you consent, one camera frame is captured and held temporarily in this browser until registration is submitted.'
                          : 'After you consent, one camera frame is sent for server-side face enrollment.'}
                    </p>
                  </div>
                )}

                {stage === 'initializing' && (
                  <div className="relative z-10 flex flex-col items-center">
                    <RefreshCw className="h-9 w-9 animate-spin text-[#56E8F2]" />
                    <p className="mt-3 text-sm font-medium text-white">Preparing your camera…</p>
                    <p className="mt-1 text-xs text-white/50">Requesting browser camera permission…</p>
                  </div>
                )}

                {stage === 'failed' && (
                  <div className="relative z-10 flex flex-col items-center max-w-sm px-4">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
                      <ShieldAlert className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {mode === 'login' ? 'Camera or face sign-in unavailable' : 'Camera or face enrollment unavailable'}
                    </p>
                    <p role="alert" className="mt-2 text-xs leading-relaxed text-white/70">{failureReason}</p>
                  </div>
                )}

                {stage === 'enrolled' && (
                  <div role="status" className="relative z-10 flex flex-col items-center max-w-sm px-4">
                    <CheckCircle2 className="mb-3 h-12 w-12 text-[#56E8F2]" />
                    <p className="text-sm font-semibold text-white">Face enrollment complete</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/70">
                      Local face processing created an encrypted template for your account. Your camera frame was not stored by Medivanta.
                    </p>
                  </div>
                )}

                {stage === 'verified' && (
                  <div role="status" className="relative z-10 flex flex-col items-center max-w-sm px-4">
                    <CheckCircle2 className="mb-3 h-12 w-12 text-[#56E8F2]" />
                    <p className="text-sm font-semibold text-white">Face sign-in verified</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/70">
                      Medivanta confirmed this sign-in with the face-verification service. Continue to open the dashboard for your account.
                    </p>
                  </div>
                )}

                {stage === 'captured' && (
                  <div role="status" className="relative z-10 flex flex-col items-center max-w-sm px-4">
                    <CheckCircle2 className="mb-3 h-12 w-12 text-[#56E8F2]" />
                    <p className="text-sm font-semibold text-white">Camera frame captured</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/70">
                      This is not face enrollment or verification. The frame will be submitted for enrollment only after your account is created.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Overlays on Live Video */}
            {(stage === 'ready' || stage === 'capturing') && (
              <>
                {/* Elegant Corner Brackets */}
                <div className="pointer-events-none absolute inset-6 flex flex-col justify-between" aria-hidden="true">
                  <div className="flex justify-between">
                    <div className="h-8 w-8 border-l-2 border-t-2 border-[#56E8F2] rounded-tl-lg shadow-[-2px_-2px_10px_rgba(86,232,242,0.5)]" />
                    <div className="h-8 w-8 border-r-2 border-t-2 border-[#56E8F2] rounded-tr-lg shadow-[2px_-2px_10px_rgba(86,232,242,0.5)]" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-8 w-8 border-l-2 border-b-2 border-[#56E8F2] rounded-bl-lg shadow-[-2px_2px_10px_rgba(86,232,242,0.5)]" />
                    <div className="h-8 w-8 border-r-2 border-b-2 border-[#56E8F2] rounded-br-lg shadow-[2px_2px_10px_rgba(86,232,242,0.5)]" />
                  </div>
                </div>

                {/* Subtle Centered Reticle */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <div className="h-44 w-36 rounded-[50%] border border-[#56E8F2]/30 shadow-[0_0_20px_rgba(86,232,242,0.15)]" />
                </div>

                {stage === 'capturing' && (
                  <div role="status" className="absolute bottom-3 inset-x-3 flex items-center justify-center rounded-xl bg-black/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md border border-white/10">
                    {mode === 'enrollment'
                      ? captureOnly ? 'Capturing frame for registration…' : 'Sending frame for server enrollment…'
                      : 'Checking your enrolled face…'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="face-scan-actions grid grid-cols-1 gap-2 sm:grid-cols-2">
          {stage === 'idle' && (
            <>
              <button
                type="button"
                onClick={startCamera}
                disabled={!consentGiven}
                className="group relative inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#56E8F2] bg-[#071423] px-4 py-2.5 text-sm font-semibold text-[#56E8F2] shadow-[0_0_20px_rgba(86,232,242,0.18)] transition-all duration-200 hover:bg-[#1E2522] hover:shadow-[0_0_28px_rgba(86,232,242,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56E8F2] active:scale-[0.99]"
              >
                <Camera className="h-4 w-4 shrink-0 text-[#56E8F2] transition-transform group-hover:scale-110" aria-hidden="true" />
                <span>Start Camera Preview</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>
            </>
          )}

          {(stage === 'enrolled' || stage === 'captured') && (
            <button
              type="button"
              onClick={handleClose}
              className="col-span-full inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#56E8F2] bg-[#56E8F2] px-4 py-2.5 text-sm font-semibold text-[#071423]"
            >
              {stage === 'captured' ? 'Return to registration' : 'Done'}
            </button>
          )}

          {stage === 'verified' && mode === 'login' && (
            <button
              type="button"
              onClick={onVerificationComplete}
              className="col-span-full inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#56E8F2] bg-[#56E8F2] px-4 py-2.5 text-sm font-semibold text-[#071423] shadow-[0_0_24px_rgba(86,232,242,0.2)]"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Continue to your dashboard
            </button>
          )}

          {stage === 'initializing' && (
            <button
              type="button"
              disabled
              className="col-span-full inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#56E8F2]/40 bg-[#071423] px-4 py-2.5 text-sm font-semibold text-[#56E8F2]/70 cursor-not-allowed opacity-80"
            >
              <RefreshCw className="h-4 w-4 animate-spin text-[#56E8F2]" />
              <span>Preparing your camera…</span>
            </button>
          )}

          {stage === 'ready' && (
            <>
              <button
                type="button"
                onClick={handleVerify}
                disabled={mode === 'enrollment' && captureDisabled}
                className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#56E8F2] bg-[#071423] px-4 py-2.5 text-sm font-semibold text-[#56E8F2] shadow-[0_0_24px_rgba(86,232,242,0.24)] transition-all duration-200 hover:bg-[#1E2522] hover:shadow-[0_0_32px_rgba(86,232,242,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56E8F2] active:scale-[0.99]"
              >
                <Scan className="h-4 w-4 shrink-0 text-[#56E8F2] transition-transform group-hover:scale-110" />
                <span>
                  {mode === 'enrollment' && captureDisabled
                    ? 'Enrollment unavailable'
                    : mode === 'enrollment'
                    ? captureOnly ? 'Capture Frame' : 'Enroll Face'
                    : 'Verify Face'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>
            </>
          )}

          {stage === 'capturing' && (
            <button
              type="button"
              disabled
              className="col-span-full inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#56E8F2]/40 bg-[#071423] px-4 py-2.5 text-sm font-semibold text-[#56E8F2]/80 cursor-wait"
            >
              <RefreshCw className="h-4 w-4 animate-spin text-[#56E8F2]" />
              <span>
                {mode === 'login'
                  ? 'Verifying your face…'
                  : mode === 'enrollment' && !captureOnly
                    ? 'Enrolling face…'
                    : 'Capturing camera frame…'}
              </span>
            </button>
          )}

          {stage === 'failed' && (
            <>
              <button
                type="button"
                onClick={startCamera}
                disabled={retryDelaySeconds > 0}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#56E8F2] bg-[#071423] px-4 py-2.5 text-sm font-semibold text-[#56E8F2] shadow-[0_0_20px_rgba(86,232,242,0.18)] transition-all duration-200 hover:bg-[#1E2522] hover:shadow-[0_0_28px_rgba(86,232,242,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56E8F2]"
              >
                <RefreshCw className="h-4 w-4 shrink-0 text-[#56E8F2]" />
                <span>
                  {retryDelaySeconds > 0
                    ? `Try face sign-in again in ${retryDelaySeconds}s`
                    : 'Retry Camera Preview'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {mode === 'login' ? 'Sign in with Password Instead' : 'Close'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
