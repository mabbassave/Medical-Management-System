import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ShieldCheck, Stethoscope, User } from 'lucide-react';
import api from '../../shared/services/api';
import { AivoraLogo } from '../atoms/AivoraLogo';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { AuthFacePanel } from './AuthFacePanel';
import { useFadeUp } from '../../shared/hooks/useFadeUp';
import { beginOAuth } from '../../shared/services/oauth';
import './RegisterPage.css';

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
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
  return { score, label: labels[score] };
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

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor'>('patient');
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
    const resetStates = () => {
      oauthStartInProgress.current = false;
      setProviderLoading(null);
    };

    window.addEventListener('pageshow', resetStates);

    return () => {
      window.removeEventListener('pageshow', resetStates);
    };
  }, []);

  useFadeUp(containerRef);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'patient',
      countryCode: '',
      phoneNumber: '',
    },
  });

  const password = watch('password', '');
  const selectedCountryCode = watch('countryCode', '');
  const strength = passwordStrength(password);

  const handleRoleSelect = (role: 'patient' | 'doctor') => {
    setSelectedRole(role);
    setValue('role', role, { shouldValidate: true });
  };

  const onSubmit = async (data: RegisterFormData) => {
    if (submitInProgress.current) return;
    submitInProgress.current = true;
    setIsSubmitting(true);
    setAuthNotice(null);

    const rawDigits = data.phoneNumber?.replace(/\D/g, '') ?? '';
    const normalizedPhone = rawDigits ? `${data.countryCode}${rawDigits}` : undefined;

    try {
      await api.post(
        '/auth/register',
        {
          username: data.username.trim(),
          fullName: data.username.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
          role: data.role,
          ...(normalizedPhone
            ? { phoneNumber: normalizedPhone, phone: normalizedPhone }
            : {}),
          ...(data.role === 'doctor'
            ? {
                specialty: data.specialty?.trim(),
                licenseNumber: data.licenseNumber?.trim(),
              }
            : {}),
        },
        { skipToast: true }
      );
      toast.success('Account created. You can sign in now.');
      navigate('/login');
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to create your account. Please try again.';
      const normalizedMessage = /already registered|email.*already exists/i.test(message)
        ? 'This user is already registered. Please log in.'
        : /username is already taken/i.test(message)
          ? 'This name is already taken. Please choose another.'
          : message;
      setAuthNotice(normalizedMessage);

      if (
        normalizedMessage === 'This user is already registered. Please log in.'
      ) {
        toast.error('This user is already registered. Please log in.');
      } else if (
        normalizedMessage.includes('Connection') ||
        normalizedMessage.includes('Network') ||
        normalizedMessage.includes('unavailable') ||
        normalizedMessage.includes('ECONNREFUSED')
      ) {
        toast.error(`Connection Problem: ${normalizedMessage}`);
      } else {
        toast.error(normalizedMessage);
      }
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const startProviderSignUp = () => {
    if (providerLoading || isSubmitting) return;
    setAuthNotice(null);
    setGoogleSignupRole(null);
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
      className="medivanta-register relative flex min-h-[100dvh] w-full items-start justify-center px-4 py-4 sm:px-6 sm:py-6 lg:py-8"
    >
      <div aria-hidden="true" className="medivanta-register-glow medivanta-register-glow-left" />
      <div aria-hidden="true" className="medivanta-register-glow medivanta-register-glow-right" />

      <div className="relative z-10 my-auto grid w-full max-w-5xl min-w-0 items-stretch gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-7">
        <section className="gsap-card medivanta-register-panel flex flex-col justify-center rounded-[1.5rem] p-4 shadow-2xl sm:p-5 lg:p-6">
          <Link
            to="/"
            className="mb-4 inline-flex w-fit items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <AivoraLogo className="h-8 w-8" />
            <span className="text-base font-bold tracking-tight text-slate-900">Medivanta</span>
          </Link>

          <div className="mb-4">
            <h1 className="register-heading text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">
              Your Journey to Better Health Starts Here
            </h1>
          </div>

          <Card className="medivanta-register-card rounded-2xl border-white/10 p-3.5 shadow-xl sm:p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5" noValidate>
              {/* Role Selection Cards */}
              <div>
                <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-slate-700">
                  Select Role <span className="text-primary">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Registration Role">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === 'patient'}
                    onClick={() => handleRoleSelect('patient')}
                    className={`group relative flex flex-col items-start rounded-xl border p-2.5 text-left transition-all duration-200 ${
                      selectedRole === 'patient'
                        ? 'border-primary bg-teal-50/70 shadow-xs ring-1 ring-primary'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between mb-0.5">
                      <User className={`h-3.5 w-3.5 ${selectedRole === 'patient' ? 'text-primary' : 'text-slate-500'}`} />
                      {selectedRole === 'patient' && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[0.62rem] font-bold text-white">
                          Selected
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-900">Patient</span>
                    <span className="hidden text-[0.62rem] leading-3 text-slate-500">Health records & appointments</span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === 'doctor'}
                    onClick={() => handleRoleSelect('doctor')}
                    className={`group relative flex flex-col items-start rounded-xl border p-2.5 text-left transition-all duration-200 ${
                      selectedRole === 'doctor'
                        ? 'border-primary bg-teal-50/70 shadow-xs ring-1 ring-primary'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between mb-0.5">
                      <Stethoscope className={`h-3.5 w-3.5 ${selectedRole === 'doctor' ? 'text-primary' : 'text-slate-500'}`} />
                      {selectedRole === 'doctor' && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[0.62rem] font-bold text-white">
                          Selected
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-900">Doctor</span>
                    <span className="hidden text-[0.62rem] leading-3 text-slate-500">Clinical practice & portal</span>
                  </button>
                </div>
              </div>

              {/* Doctor Specific Fields */}
              {selectedRole === 'doctor' && (
                <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#396EF4]">
                    <Stethoscope className="h-3.5 w-3.5" />
                    <span>Doctor Credentials</span>
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

              {/* Phone Number with Country Calling Code Selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Phone Number <span className="text-slate-400">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedCountryCode}
                    onChange={(event) =>
                      setValue('countryCode', event.target.value, { shouldValidate: true })
                    }
                    aria-label="Country Calling Code"
                    className="w-28 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:border-primary focus:outline-none"
                  >
                    <option value="" className="bg-white text-slate-900">Code</option>
                    {COUNTRY_CALLING_CODES.map((item) => (
                      <option key={`${item.code}-${item.country}`} value={item.code} className="bg-white text-slate-900">
                        {item.code} ({item.country})
                      </option>
                    ))}
                  </select>
                  <div className="flex-1">
                    <input
                      type="tel"
                      placeholder="Phone number (optional)"
                      autoComplete="tel-national"
                      className={`w-full rounded-xl border bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:outline-none ${
                        errors.phoneNumber ? 'border-red-500' : 'border-slate-300'
                      }`}
                      {...register('phoneNumber')}
                    />
                  </div>
                </div>
                {errors.phoneNumber && (
                  <p className="mt-1 text-[0.68rem] text-red-400">{errors.phoneNumber.message}</p>
                )}
                {errors.countryCode && (
                  <p className="mt-1 text-[0.68rem] text-red-400">{errors.countryCode.message}</p>
                )}
              </div>

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
                  aria-pressed={showPassword}
                  className="medivanta-register-password-toggle absolute right-2.5 top-[30px] inline-flex h-8 w-8 items-center justify-center rounded-lg"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>

              <div className="medivanta-password-strength" aria-live="polite">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span>Password strength</span>
                  <span className={strength.score >= 4 ? 'is-strong' : ''}>{strength.label}</span>
                </div>
                <div className="medivanta-strength-meter" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <span key={index} className={index < strength.score ? 'is-filled' : ''} />
                  ))}
                </div>
              </div>

              <div className="relative">
                <FormField
                  label="Confirm password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  required
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  aria-pressed={showConfirmPassword}
                  className="medivanta-register-password-toggle absolute right-2.5 top-[30px] inline-flex h-8 w-8 items-center justify-center rounded-lg"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>

              {authNotice && (
                <div className="medivanta-register-notice" role="alert" aria-live="polite">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#396EF4]" aria-hidden="true" />
                  <p>
                    {authNotice}
                    {authNotice === 'This user is already registered. Please log in.' && (
                      <>
                        {' '}
                        <Link className="font-semibold text-[#396EF4] underline" to="/login">
                          Log in
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              )}

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  className="medivanta-register-submit mt-1 min-h-10 w-full rounded-xl text-sm font-semibold shadow-lg transition-[transform,background-color,box-shadow] duration-200"
                  isLoading={isSubmitting}
                  disabled={Boolean(providerLoading)}
                >
                  {isSubmitting
                    ? 'Creating account…'
                    : `Create ${selectedRole === 'doctor' ? 'Doctor' : 'Patient'} Account`}
                </Button>
              </div>
            </form>

            <div className="relative my-3">
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
                className="medivanta-register-provider flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
                onClick={startProviderSignUp}
                disabled={isSubmitting || Boolean(providerLoading)}
                aria-label="Continue with Google"
                aria-busy={providerLoading === 'google'}
              >
                {providerLoading === 'google' ? <ProviderSpinner /> : <GoogleLogo className="h-4 w-4 shrink-0" />}
                <span>Continue with Google</span>
              </Button>
            </div>

            {providerLoading && (
              <p className="mt-2 text-center text-xs text-slate-500" role="status" aria-live="polite">
                Connecting to Google…
              </p>
            )}

            <p className="mt-3 text-center text-xs text-slate-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Login
              </Link>
            </p>
          </Card>
        </section>

        <AuthFacePanel
          badge="Join Medivanta"
        />
      </div>

      {isGoogleRoleDialogOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#202725] p-6 text-white shadow-2xl"
            role="dialog"
          >
            <h2 id="google-signup-role-title" className="text-lg font-semibold text-white">
              Choose your account type
            </h2>
            <p className="hidden mt-1 text-xs text-white/65">
              Select Patient or Doctor to continue with Google registration.
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
                    className={`group relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all duration-200 ${
                      selected
                        ? 'border-[#396EF4] bg-[#396EF4]/10 text-[#396EF4] shadow-[0_0_18px_rgba(57,110,244,0.18)] ring-1 ring-[#396EF4]'
                        : 'border-white/10 bg-white/[0.03] text-white hover:border-white/25 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                        selected ? 'bg-[#396EF4]/20 text-[#396EF4]' : 'bg-white/5 text-white/70 group-hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <span className="block text-xs font-semibold capitalize">{role}</span>
                      <span className="hidden text-[0.62rem] text-white/50">
                        {role === 'patient' ? 'Health records & care' : 'Clinical dashboard'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                className="min-h-10 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/15 hover:text-white transition-colors"
                onClick={() => {
                  setGoogleSignupRole(null);
                  setIsGoogleRoleDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="min-h-10 rounded-xl px-5 text-xs font-semibold"
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
