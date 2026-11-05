import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Stethoscope, User, Check, Sparkles } from 'lucide-react';
import api from '../../shared/services/api';
import { AivoraLogo } from '../atoms/AivoraLogo';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import { beginOAuth } from '../../shared/services/oauth';
import './RegisterPage.css';
import { BiometricAnalysisBadge } from '../atoms/BiometricAnalysisBadge';

const FaceScanModel = lazy(() =>
  import('./FaceScanModel').then(({ FaceScanModel: m }) => ({ default: m }))
);

const COUNTRY_CALLING_CODES = [
  { code: '+1', country: 'US/CA' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'AU' },
  { code: '+91', country: 'IN' },
  { code: '+92', country: 'PK' },
  { code: '+971', country: 'UAE' },
  { code: '+966', country: 'KSA' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+81', country: 'JP' },
  { code: '+86', country: 'CN' },
  { code: '+353', country: 'IE' },
  { code: '+41', country: 'CH' },
  { code: '+34', country: 'ES' },
  { code: '+39', country: 'IT' },
  { code: '+55', country: 'BR' },
];

const registerSchema = z
  .object({
    role: z.enum(['patient', 'doctor']),
    username: z.string().trim().min(3, 'Full name must be at least 3 characters'),
    email: z.string().trim().email('Please enter a valid email address'),
    countryCode: z.string(),
    phoneNumber: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          !value ||
          (/^[\d\s\-()]+$/.test(value) &&
            value.replace(/\D/g, '').length >= 7 &&
            value.replace(/\D/g, '').length <= 15),
        'Enter 7-15 digits using only standard phone number separators'
      ),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    specialty: z.string().trim().optional(),
    licenseNumber: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .superRefine((data, ctx) => {
    if (data.role === 'doctor') {
      if (!data.specialty || data.specialty.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Medical specialty is required for doctor accounts',
          path: ['specialty'],
        });
      }
      if (!data.licenseNumber || data.licenseNumber.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Medical license / registration number is required',
          path: ['licenseNumber'],
        });
      }
    }
    if (data.phoneNumber && !data.countryCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a country calling code when providing a phone number',
        path: ['countryCode'],
      });
    }
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const passwordStrength = (password: string) => {
  if (!password) return { score: 0, label: 'Use at least 8 characters' };
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (score <= 1) return { score: 1, label: 'Weak' };
  if (score <= 3) return { score: 2, label: 'Fair' };
  if (score <= 4) return { score: 3, label: 'Good' };
  return { score: 4, label: 'Strong' };
};

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

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerLoading, setProviderLoading] = useState<'google' | null>(null);
  const [isGoogleRoleDialogOpen, setIsGoogleRoleDialogOpen] = useState(false);
  const [googleSignupRole, setGoogleSignupRole] = useState<'patient' | 'doctor' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const oauthStartInProgress = useRef(false);
  const submitInProgress = useRef(false);

  useEffect(() => {
    const resetOAuthStates = () => {
      oauthStartInProgress.current = false;
      setProviderLoading(null);
      setIsGoogleRoleDialogOpen(false);
    };

    window.addEventListener('pageshow', resetOAuthStates);
    return () => {
      window.removeEventListener('pageshow', resetOAuthStates);
    };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'patient',
      countryCode: '+1',
    },
  });

  useFadeUp(containerRef);

  const selectedRole = watch('role');
  const passwordValue = watch('password') || '';
  const selectedCountryCode = watch('countryCode');
  const strength = passwordStrength(passwordValue);

  const handleRoleSelect = (role: 'patient' | 'doctor') => {
    setValue('role', role, { shouldValidate: true });
    if (role === 'patient') {
      setValue('specialty', '');
      setValue('licenseNumber', '');
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    if (submitInProgress.current) return;
    submitInProgress.current = true;
    setIsSubmitting(true);
    setAuthNotice(null);

    try {
      const payload: Record<string, string> = {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role: data.role,
      };

      if (data.phoneNumber && data.phoneNumber.trim()) {
        payload.phone = `${data.countryCode || '+1'} ${data.phoneNumber.trim()}`;
      }

      if (data.role === 'doctor') {
        payload.specialty = (data.specialty || '').trim();
        payload.licenseNumber = (data.licenseNumber || '').trim();
      }

      await api.post('/auth/register', payload);
      toast.success('Account created successfully! Please sign in.');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        error.response?.data?.message ||
          error.message ||
          'Registration failed. Please check your information.'
      );
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const startProviderSignUp = () => {
    if (providerLoading || isSubmitting) return;
    setAuthNotice(null);
    setGoogleSignupRole(selectedRole === 'doctor' ? 'doctor' : 'patient');
    setIsGoogleRoleDialogOpen(true);
  };

  const continueGoogleSignUp = () => {
    if (!googleSignupRole || oauthStartInProgress.current || providerLoading || isSubmitting) return;
    oauthStartInProgress.current = true;
    setProviderLoading('google');
    setIsGoogleRoleDialogOpen(false);

    try {
      beginOAuth('google', googleSignupRole, 'register');
    } catch (error) {
      oauthStartInProgress.current = false;
      setProviderLoading(null);
      const msg =
        error instanceof Error ? error.message : 'Unable to connect to sign-up provider.';
      setAuthNotice(msg);
      toast.error(msg);
    }
  };

  return (
    <main
      ref={containerRef}
      className="medivanta-register relative flex min-h-[100dvh] w-full items-center justify-center px-4 py-10 sm:px-6 lg:px-8 bg-[#F8FAFC]"
    >
      <div className="relative z-10 w-full max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-7">
            <section className="gsap-card rounded-[2.5rem] border border-slate-200/90 bg-white p-7 sm:p-10 shadow-card">
          
          {/* Logo & Headline */}
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
              Create your account
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Join MediCure for personalized healthcare and streamlined patient appointments
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            
            {/* Role Selection Pills */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Account Type <span className="text-emerald-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Registration Role">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedRole === 'patient'}
                  onClick={() => handleRoleSelect('patient')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    selectedRole === 'patient'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <User className={`h-4 w-4 ${selectedRole === 'patient' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold">Patient</span>
                  </div>
                  {selectedRole === 'patient' && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedRole === 'doctor'}
                  onClick={() => handleRoleSelect('doctor')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    selectedRole === 'doctor'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Stethoscope className={`h-4 w-4 ${selectedRole === 'doctor' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold">Doctor</span>
                  </div>
                  {selectedRole === 'doctor' && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Doctor Specific Fields */}
            {selectedRole === 'doctor' && (
              <div className="space-y-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <Stethoscope className="h-4 w-4" />
                  <span>Physician Credentials</span>
                </div>
                <FormField
                  label="Medical Specialty"
                  type="text"
                  placeholder="e.g. Cardiology, Internal Medicine"
                  required
                  error={errors.specialty?.message}
                  {...register('specialty')}
                />
                <FormField
                  label="Medical License / Registration No."
                  type="text"
                  placeholder="e.g. MD-849201"
                  required
                  error={errors.licenseNumber?.message}
                  {...register('licenseNumber')}
                />
              </div>
            )}

            <FormField
              label="Full name"
              type="text"
              placeholder="Your first and last name"
              autoComplete="name"
              required
              maxLength={80}
              error={errors.username?.message}
              {...register('username')}
            />

            <FormField
              label="Email address"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />

            {/* Phone Number */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">
                Phone Number <span className="text-slate-400 text-xs">(optional)</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCountryCode}
                  onChange={(event) =>
                    setValue('countryCode', event.target.value, { shouldValidate: true })
                  }
                  aria-label="Country Calling Code"
                  className="w-32 rounded-2xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="" className="bg-white text-slate-800">Code</option>
                  {COUNTRY_CALLING_CODES.map((item) => (
                    <option key={`${item.code}-${item.country}`} value={item.code}>
                      {item.code} ({item.country})
                    </option>
                  ))}
                </select>
                <div className="flex-1">
                  <input
                    type="tel"
                    placeholder="Phone number (optional)"
                    autoComplete="tel-national"
                    className={`h-12 w-full rounded-2xl border bg-white px-4 text-xs text-slate-800 placeholder:text-slate-400 transition-colors focus:border-emerald-500 focus:outline-none ${
                      errors.phoneNumber ? 'border-rose-400' : 'border-slate-200'
                    }`}
                    {...register('phoneNumber')}
                  />
                </div>
              </div>
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-rose-500">{errors.phoneNumber.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="relative">
              <FormField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="medivanta-password-toggle absolute right-3 top-[34px] inline-flex h-8 w-8 items-center justify-center rounded-lg hover:text-slate-900"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {passwordValue && (
              <div className="space-y-1">
                <div className="password-strength-bar">
                  <div
                    className={`password-strength-fill ${
                      strength.score <= 1
                        ? 'bg-rose-500 w-1/4'
                        : strength.score === 2
                        ? 'bg-amber-500 w-2/4'
                        : strength.score === 3
                        ? 'bg-emerald-500 w-3/4'
                        : 'bg-emerald-600 w-full'
                    }`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Strength: {strength.label}</span>
                  <span>Minimum 8 chars</span>
                </div>
              </div>
            )}

            {/* Confirm Password */}
            <div className="relative">
              <FormField
                label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="medivanta-password-toggle absolute right-3 top-[34px] inline-flex h-8 w-8 items-center justify-center rounded-lg hover:text-slate-900"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Primary Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="black"
                className="min-h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 hover:shadow-md"
                isLoading={isSubmitting}
                disabled={Boolean(providerLoading)}
              >
                {isSubmitting
                  ? 'Creating account…'
                  : `Create ${selectedRole === 'doctor' ? 'Doctor' : 'Patient'} Account`}
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          {authNotice && (
            <div className="medivanta-auth-notice mb-4 text-center" role="status" aria-live="polite">
              <p className="text-xs text-rose-600 font-medium">{authNotice}</p>
            </div>
          )}

          <div>
            <Button
              type="button"
              variant="secondary"
              className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
              onClick={startProviderSignUp}
              disabled={isSubmitting || Boolean(providerLoading)}
              aria-label="Continue with Google"
              aria-busy={providerLoading === 'google'}
            >
              {providerLoading === 'google' ? <ProviderSpinner /> : <GoogleLogo className="h-4 w-4 shrink-0" />}
              <span>Continue with Google</span>
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>

      {/* Right Column: 3D Face Scan Model Showcase */}
      <div className="lg:col-span-5 hidden lg:flex flex-col justify-between h-full min-h-[580px] rounded-[32px] border border-slate-200/80 bg-white p-8 relative overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.04)]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-[#148F3A]" />
            <span>Biometric Registration</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Next-Gen Clinical Security
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            MediCure enables passwordless check-ins, automated clinical vitals, and secure record access.
          </p>
        </div>

        {/* 3D Model Interactive Viewport - Matching Login page size, scale, and framing */}
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
            <span>Optional face biometric enrollment after registration</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
            <div className="h-1.5 w-1.5 rounded-full bg-[#148F3A] shrink-0" />
            <span>Encrypted local biometric telemetry</span>
          </div>
        </div>
      </div>

    </div>
  </div>

  {isGoogleRoleDialogOpen && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setGoogleSignupRole(null);
              setIsGoogleRoleDialogOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="google-signup-role-title"
            aria-modal="true"
            className="w-full max-w-md rounded-[2.5rem] border border-slate-200 bg-white p-7 text-slate-900 shadow-2xl"
            role="dialog"
          >
            <h2 id="google-signup-role-title" className="text-xl font-bold text-slate-900">
              Select your account type
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select whether you are registering as a Patient or a Doctor.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Google sign-up role">
              {(['patient', 'doctor'] as const).map((role) => {
                const selected = googleSignupRole === role;
                const Icon = role === 'patient' ? User : Stethoscope;
                return (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setGoogleSignupRole(role)}
                    className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-6 w-6 text-emerald-600" />
                    <span className="text-sm font-bold capitalize">{role}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                className="min-h-10 rounded-full px-5 text-xs font-semibold"
                onClick={() => {
                  setGoogleSignupRole(null);
                  setIsGoogleRoleDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="black"
                className="min-h-10 rounded-full px-6 text-xs font-semibold text-white"
                disabled={!googleSignupRole}
                onClick={continueGoogleSignUp}
              >
                Continue with Google
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
