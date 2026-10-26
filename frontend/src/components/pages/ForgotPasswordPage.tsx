import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, ArrowLeft } from 'lucide-react';
import api from '../../shared/services/api';
import { AivoraLogo } from '../atoms/AivoraLogo';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email }) as { message?: string };
      toast.success(res.message || 'Reset code sent to your email');
      navigate('/verify-otp', { state: { email } });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to send reset code';
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
      {/* Ambient background glows */}
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
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-textPrimary sm:text-2xl">
              Forgot Password
            </h1>
            <p className="mt-1.5 text-xs font-medium text-textSecondary sm:text-sm">
              Enter your registered email and we&apos;ll send you a 6-digit OTP code.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              label="Email Address"
              type="email"
              placeholder="doctor@hospital.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              className="mt-3 w-full py-3"
              isLoading={isLoading}
            >
              Send Reset Code
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-textSecondary">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-emerald-300 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};
