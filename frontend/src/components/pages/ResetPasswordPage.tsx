import React, { useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, ArrowLeft } from 'lucide-react';
import api from '../../shared/services/api';
import { AivoraLogo } from '../atoms/AivoraLogo';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string; otp?: string } | null;
  const email = state?.email || '';
  const otp = state?.otp || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { email, otp, newPassword }) as { message?: string };
      toast.success(res.message || 'Password reset successfully! Please log in.');
      navigate('/login');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to reset password';
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
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-textPrimary sm:text-2xl">
              Set New Password
            </h1>
            <p className="mt-1.5 text-xs font-medium text-textSecondary sm:text-sm">
              Create a secure new password for your account.
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <FormField
              label="New Password"
              type="password"
              placeholder="••••••••"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <FormField
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              className="mt-3 w-full py-3"
              isLoading={isLoading}
            >
              Reset Password
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-textSecondary">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-dark hover:underline"
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
