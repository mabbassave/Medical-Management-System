import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ScanFace, ShieldCheck, Sparkles } from 'lucide-react';
import api from '../../shared/services/api';
import { COOKIE_SESSION, useAuthStore, type User } from '../../store/authStore';
import { AivoraLogo } from '../atoms/AivoraLogo';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import { beginOAuth } from '../../shared/services/oauth';
import { FaceScanModal } from '../molecules/FaceScanModal';
import { BiometricAnalysisBadge } from '../atoms/BiometricAnalysisBadge';
import { getRoleHomeRoute } from '../../shared/utils/roleRoutes';
import './LoginPage.css';

const FaceScanModel = lazy(() =>
  import('./FaceScanModel').then(({ FaceScanModel: m }) => ({ default: m }))
);

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const GoogleLogo: React.FC<{ className?: string }> = ({ className = 'h-4 w-4 shrink-0' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const ProviderSpinner: React.FC = () => (
  <svg
    className="h-4 w-4 shrink-0 animate-spin text-emerald-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3.5"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerLoading, setProviderLoading] = useState<'google' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [signInNotice, setSignInNotice] = useState<string | null>(null);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [verifiedFaceUser, setVerifiedFaceUser] = useState<User | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const oauthStartInProgress = useRef(false);
  const submitInProgress = useRef(false);
  const faceLoginInProgress = useRef(false);

  useEffect(() => {
    const resetStates = () => {
      oauthStartInProgress.current = false;
      setProviderLoading(null);
    };

    window.addEventListener('pageshow', resetStates);

    return () => {
      window.removeEventListener('pageshow', resetStates);
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  useFadeUp(containerRef);

  const onSubmit = async (data: LoginFormData) => {
    if (submitInProgress.current) return;
    submitInProgress.current = true;
    setIsSubmitting(true);
    setSignInNotice(null);

    try {
      const response = await api.post('/auth/login', {
        email: data.email.trim().toLowerCase(),
        password: data.password,
      }) as {
        token?: string;
        user?: User;
      };

      const user = response?.user;
      if (!user) {
        throw new Error('Authentication succeeded but user details were not received.');
      }

      login(user, response?.token || COOKIE_SESSION);
      toast.success('Welcome back!');

      const targetPath = getRoleHomeRoute(user.role) || '/dashboard';
      navigate(targetPath, { replace: true });
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        error.response?.data?.message || error.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const handleProviderLogin = () => {
    if (oauthStartInProgress.current || providerLoading !== null || isSubmitting) {
      return;
    }
    oauthStartInProgress.current = true;
    setProviderLoading('google');
    setSignInNotice('Redirecting to Google authentication…');
    try {
      beginOAuth('google');
    } catch (err) {
      oauthStartInProgress.current = false;
      setProviderLoading(null);
      setSignInNotice(null);
      const msg = err instanceof Error ? err.message : 'Unable to connect to Google. Please try again.';
      toast.error(msg);
    }
  };

  const handleFaceVerification = async (image: Blob) => {
    if (faceLoginInProgress.current) return;
    faceLoginInProgress.current = true;
    setSignInNotice(null);
    setVerifiedFaceUser(null);
    try {
      const formData = new FormData();
      formData.append('image', image, 'face-verify.jpg');
      formData.append('consent', 'true');
      const response = await api.post('/auth/face-verify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true,
        timeout: 30000,
      }) as {
        verified?: boolean;
        token?: string;
        user?: User;
      };

      if (response.verified !== true || !response.user) {
        throw new Error('Face sign-in could not be verified. Please use your email and password.');
      }
      if (!getRoleHomeRoute(response.user.role)) {
        throw new Error('The verified account does not have an available dashboard. Please contact support.');
      }
      setVerifiedFaceUser(response.user);
      login(response.user, response.token || COOKIE_SESSION);
    } finally {
      faceLoginInProgress.current = false;
    }
  };

  return (
    <main
      ref={containerRef}
      className="medivanta-login relative flex min-h-[100dvh] w-full items-center justify-center px-4 py-8 sm:px-6 lg:px-8 bg-[#F8FAFC]"
    >
      <div className="relative z-10 w-full max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Sign In Form */}
          <div className="lg:col-span-7">
            <section className="gsap-card rounded-[2.5rem] border border-slate-200/90 bg-white p-7 sm:p-10 shadow-card">
              
              {/* Brand Logo & Name */}
              <div className="flex flex-col items-center text-center mb-6">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2.5 rounded-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <AivoraLogo className="h-9 w-9" />
                  <span className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
                    MediCure
                    <span className="ml-1 h-2 w-2 rounded-full bg-[#EAB308]" />
                  </span>
                </Link>
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                  Welcome back
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Sign in to access your appointments and clinical records
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  label="Email address"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  error={errors.email?.message}
                  {...register('email')}
                />

                <div className="relative">
                  <FormField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="medivanta-password-toggle absolute right-3 top-[34px] inline-flex h-8 w-8 items-center justify-center rounded-lg hover:text-slate-900 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>

                <div className="flex justify-end pt-0.5">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Primary Button */}
                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="black"
                    className="min-h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 hover:shadow-md"
                    isLoading={isSubmitting}
                    disabled={Boolean(providerLoading)}
                  >
                    {isSubmitting ? 'Signing in…' : 'Sign in to MediCure'}
                  </Button>
                </div>
              </form>

              {/* Social Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 font-medium">Or continue with</span>
                </div>
              </div>

              <div className="grid gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
                  onClick={handleProviderLogin}
                  disabled={isSubmitting || Boolean(providerLoading)}
                  aria-label="Continue with Google"
                  aria-busy={providerLoading === 'google'}
                >
                  {providerLoading === 'google' ? <ProviderSpinner /> : <GoogleLogo className="h-4 w-4 shrink-0" />}
                  <span>Continue with Google</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
                  onClick={() => setIsFaceModalOpen(true)}
                  disabled={Boolean(providerLoading) || isSubmitting}
                >
                  <ScanFace className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span>Sign in with Face</span>
                </Button>
              </div>

              {providerLoading && (
                <p className="mt-3 text-center text-xs text-slate-500" role="status" aria-live="polite">
                  Connecting to Google…
                </p>
              )}

              {signInNotice && (
                <div className="medivanta-auth-notice mt-4" role="status" aria-live="polite">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p>{signInNotice}</p>
                </div>
              )}

              <p className="mt-6 text-center text-xs text-slate-500">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
                >
                  Create your account
                </Link>
              </p>
            </section>
          </div>

          {/* Right Column: 3D Face Scan Model Showcase */}
          <div className="lg:col-span-5 hidden lg:flex flex-col justify-between h-full min-h-[580px] rounded-[30px] border border-slate-200/80 bg-white p-8 relative overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.04)]">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-[#148F3A]" />
                <span>AI Biometric Security</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Instant Patient & Doctor Sign-in
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Encrypted 3D face matching allows swift, passwordless authentication with maximum privacy.
              </p>
            </div>

            {/* 3D Model Interactive Viewport - Curved with 28px rounded corners and overflow hidden */}
            <div className="relative my-4 h-[350px] sm:h-[370px] w-full rounded-[28px] overflow-hidden border border-slate-100 bg-white shadow-sm">
              <Suspense fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-white rounded-[28px]">
                  <div className="h-7 w-7 rounded-full border-2 border-[#148F3A] border-t-transparent animate-spin" />
                </div>
              }>
                <div className="absolute inset-0 rounded-[28px] overflow-hidden">
                  <FaceScanModel followPointer normalizeSize scaleMultiplier={1.25} />
                </div>
              </Suspense>
              <BiometricAnalysisBadge className="absolute bottom-3 right-3 z-10 scale-90 sm:scale-100 origin-bottom-right" />
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
                <div className="h-1.5 w-1.5 rounded-full bg-[#148F3A] shrink-0" />
                <span>Passwordless clinical verification</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
                <div className="h-1.5 w-1.5 rounded-full bg-[#148F3A] shrink-0" />
                <span>Encrypted in-memory facial telemetry</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <FaceScanModal
        isOpen={isFaceModalOpen}
        onClose={() => {
          setIsFaceModalOpen(false);
          setVerifiedFaceUser(null);
        }}
        mode="login"
        onFaceVerification={handleFaceVerification}
        onVerificationComplete={() => {
          const userToUse = verifiedFaceUser || useAuthStore.getState().user;
          if (!userToUse) return;
          const destination = getRoleHomeRoute(userToUse.role) || '/dashboard';
          setIsFaceModalOpen(false);
          toast.success('Face sign-in verified. Welcome back!');
          navigate(destination, { replace: true });
        }}
      />
    </main>
  );
};
