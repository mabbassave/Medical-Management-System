import React, { useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import api from '../../shared/services/api';
import { AivoraLogo } from '../atoms/AivoraLogo';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

export const VerifyOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { email?: string } | null;
  const [email, setEmail] = useState(locationState?.email || '');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) {
      toast.error('Please enter both your email and OTP code');
      return;
    }
    if (otp.length < 6) {
      toast.error('OTP must be 6 digits');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post('/auth/verify-reset-otp', { email, otp }) as { message?: string };
      toast.success(res.message || 'OTP verified successfully');
      navigate('/reset-password', { state: { email, otp } });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Invalid or expired OTP';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background px-4 py-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2.5 focus-visible:outline-none">
            <AivoraLogo className="h-9 w-9" />
            <span className="text-xl font-bold tracking-tight text-textPrimary">Medivanta</span>
          </Link>
        </div>

        <Card className="border-border/80 bg-surface/90 shadow-2xl backdrop-blur-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-textPrimary sm:text-2xl">
              Verify OTP Code
            </h1>
            <p className="mt-1.5 text-xs font-medium text-textSecondary sm:text-sm">
              Enter the 6-digit code sent to{' '}
              {email ? (
                <strong className="text-textPrimary font-semibold">{email}</strong>
              ) : (
                'your email'
              )}.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            {!locationState?.email && (
              <FormField
                label="Email Address"
                type="email"
                placeholder="doctor@hospital.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            <FormField
              label="6-Digit OTP"
              type="text"
              maxLength={6}
              placeholder="123456"
              required
              className="text-center tracking-widest text-lg font-bold"
              value={otp}
              onChange={(e) => setOtp(e.target.value.trim())}
            />
            <Button
              type="submit"
              variant="primary"
              className="mt-3 w-full py-3"
              isLoading={isLoading}
            >
              Verify Code
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 text-xs text-textSecondary">
            <p>
              Didn&apos;t receive a code?{' '}
              <Link
                to="/forgot-password"
                className="font-semibold text-primary hover:text-emerald-300 hover:underline"
              >
                Request again
              </Link>
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 font-semibold text-textSecondary hover:text-textPrimary"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
