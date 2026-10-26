import React from 'react';
import { BadgeCheck, Mail, Phone, Stethoscope, UserRound } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../molecules/Card';
import { DashboardLayout } from '../templates/DashboardLayout';

export const DoctorProfilePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl py-2">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-textPrimary">My Profile</h1>
          <p className="mt-1 text-sm text-textSecondary">Account and clinical credentials associated with your signed-in profile.</p>
        </header>

        <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
          <div className="flex items-center gap-5 border-b border-border pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs shrink-0">
              <UserRound className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-textPrimary">{user?.name || user?.username || 'Doctor'}</h2>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mt-1.5">
                {user?.specialty || 'Medical professional'}
              </span>
            </div>
          </div>

          <dl className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
              <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-textMuted">Email Address</dt>
                <dd className="mt-0.5 break-all text-sm font-medium text-textPrimary">{user?.email || 'Not provided'}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
              <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-textMuted">Phone Number</dt>
                <dd className="mt-0.5 text-sm font-medium text-textPrimary">{user?.phoneNumber || user?.phone || 'Not provided'}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
              <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0">
                <Stethoscope className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-textMuted">Specialty</dt>
                <dd className="mt-0.5 text-sm font-medium text-textPrimary">{user?.specialty || 'General Practice'}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
              <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-textMuted">License Number</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-textPrimary">{user?.licenseNumber || 'Verified'}</dd>
              </div>
            </div>
          </dl>
        </Card>
      </div>
    </DashboardLayout>
  );
};
