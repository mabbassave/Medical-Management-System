import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Info, LoaderCircle, ScanFace, ShieldAlert, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../shared/services/api';
import { useAuthStore } from '../../store/authStore';
import { FaceScanModal } from '../molecules/FaceScanModal';

interface FaceEnrollmentResponse {
  enrolled?: boolean;
  deleted?: boolean;
  faceEnrollmentStatus?: string;
}

export const FaceEnrollPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [enrollmentAvailable, setEnrollmentAvailable] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string | undefined>(
    user?.faceEnrollmentStatus
  );
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/auth/session', { skipToast: true })
      .then((response) => {
        const session = response as {
          user?: typeof user & {
            faceEnrollmentAvailable?: boolean;
            faceEnrollmentStatus?: string;
          };
        };
        if (!active) return;
        if (!session.user || !token) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setEnrollmentAvailable(Boolean(session.user.faceEnrollmentAvailable));
        setEnrollmentStatus(session.user.faceEnrollmentStatus);
        login(session.user, token);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error
          ? requestError.message
          : 'Unable to check face enrollment for this account.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [login, logout, navigate, token]);

  const finish = useCallback(() => {
    navigate(user?.role.toLowerCase() === 'patient' ? '/portal' : '/dashboard', { replace: true });
  }, [navigate, user?.role]);

  const enrollFace = useCallback(async (image: Blob) => {
    setError('');
    const formData = new FormData();
    formData.append('image', image, 'face-enrollment.jpg');
    formData.append('consent', 'true');
    const result = await api.post(
      '/auth/face-enroll',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true,
      }
    ) as FaceEnrollmentResponse;

    if (!result.enrolled || result.faceEnrollmentStatus !== 'enrolled') {
      throw new Error('The server did not confirm that your face template and consent were saved. Please retry.');
    }

    setEnrollmentStatus('enrolled');
    if (user && token) {
      login({ ...user, faceEnrollmentStatus: 'enrolled', faceEnrollmentAvailable: true }, token);
    }
    toast.success('Face enrollment completed and saved to your account.');
  }, [login, token, user]);


  const deleteEnrollment = async () => {
    if (!window.confirm(
      'Delete your saved face template and withdraw face sign-in consent? You will no longer be able to use Face Login until you enroll again.'
    )) return;

    setIsDeleting(true);
    setError('');
    try {
      const result = await api.delete('/auth/face-enroll', {
        skipToast: true,
      }) as FaceEnrollmentResponse;
      if (!result.deleted || result.faceEnrollmentStatus !== 'not_enrolled') {
        throw new Error('The server did not confirm deletion of your face enrollment.');
      }
      setEnrollmentStatus('not_enrolled');
      if (user && token) {
        login({ ...user, faceEnrollmentStatus: 'not_enrolled' }, token);
      }
      toast.success('Face template deleted and consent withdrawn.');
    } catch (requestError: unknown) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Face enrollment could not be deleted. Please retry.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Track whether the user just completed enrollment in this session
  const [enrolledThisSession, setEnrolledThisSession] = useState(false);

  const enrollFaceWithSession = useCallback(async (image: Blob) => {
    await enrollFace(image);
    setEnrolledThisSession(true);
  }, [enrollFace]);

  const isEnrolled = enrollmentStatus === 'enrolled';

  return (
    <main className="face-enrollment-page min-h-screen bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 flex items-center justify-center">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-emerald-500/20 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl ring-1 ring-white/10">
        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
            <ScanFace className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Account Security</p>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Face Sign-in Setup</h1>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-300">
          With your explicit consent, Medivanta captures one camera frame to generate a secure biometric embedding in memory. The raw image is immediately discarded—only an encrypted mathematical template linked to your account is retained.
        </p>

        {/* Step-by-step enrollment instructions */}
        <div className="my-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
          <div className="mb-3.5 flex items-center gap-2 text-emerald-400">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider">How to configure Face Sign-in</span>
          </div>
          <ol className="space-y-3 text-xs sm:text-sm text-slate-300" aria-label="Face sign-in setup steps">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">1</span>
              <span>Ensure you are authenticated with your account password.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">2</span>
              <span>Read and acknowledge the biometric consent prompt when starting scan.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">3</span>
              <span>Grant browser webcam permission when prompted by your browser.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">4</span>
              <span>Center your face within the biometric oval reticle and capture.</span>
            </li>
          </ol>
        </div>

        <div className="my-6 rounded-2xl border border-white/10 bg-slate-800/60 p-4">
          {isLoading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" aria-hidden="true" />
              Checking biometric enrollment status…
            </p>
          ) : isEnrolled && enrolledThisSession ? (
            // Just-enrolled success message
            <div role="status" className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Face registration successful!
              </p>
              <p className="text-xs text-slate-300">
                Next time, simply choose <strong className="text-white">Face Login</strong> on the login page to sign in instantaneously.
              </p>
            </div>
          ) : isEnrolled ? (
            <p role="status" className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              Face sign-in is active and configured for this account.
            </p>
          ) : (
            <p className="text-sm text-slate-300">
              No active face enrollment found for this account.
            </p>
          )}
        </div>

        {!enrollmentAvailable && !isLoading && (
          <p role="alert" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:text-sm text-amber-200">
            Face enrollment is not available on this server environment. Password sign-in remains active.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs sm:text-sm text-red-200">
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row pt-2">
          {!isEnrolled && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setIsEnrollmentOpen(true);
              }}
              disabled={isLoading}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-bold text-white shadow-lg hover:from-emerald-600 hover:to-teal-600 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ScanFace className="h-4 w-4" aria-hidden="true" />
              {enrollmentAvailable ? 'Enroll My Face' : 'Preview Camera'}
            </button>
          )}
          {isEnrolled && (
            <button
              type="button"
              onClick={deleteEnrollment}
              disabled={isDeleting}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 text-sm font-semibold text-red-300 hover:bg-red-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isDeleting
                ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Withdraw Consent & Delete Template
            </button>
          )}
          <button
            type="button"
            onClick={finish}
            className="min-h-11 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            Return to Account
          </button>
        </div>
      </section>

      <FaceScanModal
        isOpen={isEnrollmentOpen}
        onClose={() => setIsEnrollmentOpen(false)}
        mode="enrollment"
        onEnrollmentCapture={enrollFaceWithSession}
        captureDisabled={!enrollmentAvailable}
      />
    </main>
  );
};
