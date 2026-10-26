import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ScanFace, ShieldCheck } from 'lucide-react';
import api from '../../shared/services/api';
import { COOKIE_SESSION, useAuthStore, type User } from '../../store/authStore';
import { AivoraLogo } from '../atoms/AivoraLogo';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import { beginOAuth } from '../../shared/services/oauth';
import { FaceScanModal } from '../molecules/FaceScanModal';
import { AuthFacePanel } from './AuthFacePanel';
import { getRoleHomeRoute } from '../../shared/utils/roleRoutes';
import './LoginPage.css';

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
    className="h-4 w-4 shrink-0 animate-spin text-[#396EF4]"
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
      const response = await api.post(
        '/auth/login',
        {
          email: data.email.trim().toLowerCase(),
          password: data.password,
        },
        { skipToast: true }
      ) as {
        user?: {
          id: string;
          name?: string;
          username?: string;
          fullName?: string;
          email: string;
          role: string;
          patientId?: string;
          doctorId?: string;
        };
        token?: string;
        message?: string;
      };
      if (!response.user) {
        throw new Error('Login succeeded but the server did not return a user account.');
      }
      const destination = getRoleHomeRoute(response.user.role);
      if (!destination) {
        throw new Error('Your account role could not be confirmed. Please contact support.');
      }
      login(response.user, response.token || COOKIE_SESSION);
      toast.success('Welcome Back!');
      navigate(destination);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid credentials';
      setSignInNotice(message);
      if (
        message.includes('Connection') ||
        message.includes('Network') ||
        message.includes('unavailable') ||
        message.includes('ECONNREFUSED')
      ) {
        toast.error(`Connection Problem: ${message}`);
      } else {
        toast.error(message);
      }
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const handleProviderLogin = () => {
    if (oauthStartInProgress.current || providerLoading || isSubmitting) return;
    oauthStartInProgress.current = true;
    setSignInNotice(null);
    setProviderLoading('google');

    try {
      beginOAuth('google', 'patient');
    } catch (error) {
      oauthStartInProgress.current = false;
      setProviderLoading(null);
      const msg = error instanceof Error ? error.message : 'Unable to connect to sign-in provider.';
      setSignInNotice(msg);
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
      formData.append('image', image, 'face-login.jpg');
      formData.append('consent', 'true');
      const response = await api.post('/auth/face-verify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true,
        timeout: 30000,
      }) as {
        verified?: boolean;
        user?: User;
      };

      if (response.verified !== true || !response.user) {
        throw new Error('Face sign-in could not be verified. Please use your email and password.');
      }
      if (!getRoleHomeRoute(response.user.role)) {
        throw new Error('The verified account does not have an available dashboard. Please contact support.');
      }
      setVerifiedFaceUser(response.user);
    } finally {
      faceLoginInProgress.current = false;
    }
  };

  return (
    <main ref={containerRef} className="medivanta-login relative flex min-h-[100dvh] w-full items-start justify-center px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
      <div aria-hidden="true" className="medivanta-login-glow medivanta-login-glow-left" />
      <div aria-hidden="true" className="medivanta-login-glow medivanta-login-glow-right" />

      <div className="relative z-10 my-auto grid w-full max-w-5xl min-w-0 items-stretch gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:gap-7">
        <section className="gsap-card medivanta-login-panel flex flex-col justify-center rounded-[1.5rem] p-4 shadow-2xl sm:p-6 lg:p-7">
          <Link to="/" className="mb-4 inline-flex w-fit items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <AivoraLogo className="h-8 w-8" />
            <span className="text-base font-bold tracking-tight text-slate-900">Medivanta</span>
          </Link>

          <div className="mb-4">
            <h1 className="login-heading text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">
              Welcome Back
            </h1>
          </div>

          <Card className="medivanta-login-card rounded-2xl border-white/10 p-3.5 shadow-xl sm:p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
              <FormField
                label="Email address"
                type="email"
                placeholder="you@hospital.com"
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
                  className="medivanta-password-toggle absolute right-2.5 top-[30px] inline-flex h-8 w-8 items-center justify-center rounded-lg"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>

              <div className="flex justify-end pt-0.5">
                <Link to="/forgot-password" className="rounded-sm text-xs font-semibold text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  Forgot password?
                </Link>
              </div>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  className="medivanta-login-submit min-h-10 w-full rounded-xl text-sm font-semibold shadow-lg transition-[transform,background-color,box-shadow] duration-200"
                  isLoading={isSubmitting}
                  disabled={Boolean(providerLoading)}
                >
                  {isSubmitting ? 'Signing in…' : 'Login'}
                </Button>
              </div>
            </form>

            <div className="relative my-3.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-500 font-medium">Or continue with</span>
              </div>
            </div>

            <div className="grid gap-2.5">
              <Button
                type="button"
                variant="secondary"
                className="medivanta-provider-button flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
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
                className="medivanta-provider-button flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
                onClick={() => setIsFaceModalOpen(true)}
                disabled={Boolean(providerLoading) || isSubmitting}
              >
                <ScanFace className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Sign in with Face</span>
              </Button>
            </div>

            {providerLoading && (
              <p className="mt-2 text-center text-xs text-white/55" role="status" aria-live="polite">
                Connecting to Google…
              </p>
            )}

            {signInNotice && (
              <div className="medivanta-auth-notice mt-3" role="status" aria-live="polite">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#396EF4]" aria-hidden="true" />
                <p>{signInNotice}</p>
              </div>
            )}

            <p className="mt-3.5 text-center text-xs text-slate-600">
              New to Medivanta?{' '}
              <Link to="/register" className="font-semibold text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                Create your account
              </Link>
            </p>
          </Card>
        </section>

        <AuthFacePanel
          badge="Secure Clinical Workspace"
        />
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
          if (!verifiedFaceUser) return;
          const destination = getRoleHomeRoute(verifiedFaceUser.role);
          if (!destination) return;
          login(verifiedFaceUser, COOKIE_SESSION);
          toast.success('Face sign-in verified. Welcome back!');
          navigate(destination, { replace: true });
        }}
      />
    </main>
  );
};
