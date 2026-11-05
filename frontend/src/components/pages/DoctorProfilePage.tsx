import React, { useEffect, useState } from 'react';
import { BadgeCheck, Mail, Phone, Stethoscope, UserRound } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../shared/services/api';
import { Card } from '../molecules/Card';
import { DashboardLayout } from '../templates/DashboardLayout';

type DoctorProfile = { fullName: string; email: string; phone: string; specialization: string; licenseNumber?: string; doctorVerificationStatus?: string };

export const DoctorProfilePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<DoctorProfile>({ fullName: '', email: user?.email || '', phone: '', specialization: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const setUser = useAuthStore((state) => state.login);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    let active = true;
    api.get('/doctors/me', { skipToast: true }).then((res: any) => {
      const data = res?.data || res;
      if (active && data) setProfile({
        fullName: data.fullName || user?.fullName || user?.name || '',
        email: user?.email || data.email || '',
        phone: data.phone || user?.phoneNumber || user?.phone || '',
        specialization: data.specialization || user?.specialty || '',
        licenseNumber: data.licenseNumber || user?.licenseNumber,
        doctorVerificationStatus: data.doctorVerificationStatus || user?.doctorVerificationStatus,
      });
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res: any = await api.put('/doctors/me', { fullName: profile.fullName, phone: profile.phone, specialty: profile.specialization }, { skipToast: true });
      const data = res?.data || res;
      setProfile((current) => ({ ...current, ...data, specialization: data.specialization ?? current.specialization }));
      if (user && token) setUser({ ...user, fullName: data.fullName, name: data.fullName, phone: data.phone, phoneNumber: data.phone, specialty: data.specialization }, token);
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save profile.'); }
    finally { setSaving(false); }
  };

  const field = (label: string, key: 'fullName' | 'phone' | 'specialization', icon: React.ReactNode) => (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
      <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-textMuted">{label}</label>
        {editing ? <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-textPrimary" value={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} /> : <p className="mt-0.5 text-sm font-medium text-textPrimary">{profile[key] || 'Not provided'}</p>}
      </div>
    </div>
  );

  return <DashboardLayout><div className="mx-auto w-full max-w-3xl py-2">
    <header className="mb-6"><h1 className="text-2xl font-bold tracking-tight text-textPrimary">My Profile</h1><p className="mt-1 text-sm text-textSecondary">Account and clinical credentials associated with your signed-in profile.</p></header>
    <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-center gap-5 border-b border-border pb-6"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs shrink-0"><UserRound className="h-8 w-8" aria-hidden="true" /></div><div className="min-w-0"><h2 className="text-xl font-bold text-textPrimary">{profile.fullName || user?.name || user?.username || 'Doctor'}</h2><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mt-1.5">{profile.specialization || 'Medical professional'}</span></div></div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      <dl className="grid gap-4 pt-6 sm:grid-cols-2">{field('Full Name', 'fullName', <UserRound className="h-4 w-4" />)}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border"><div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0"><Mail className="h-4 w-4" /></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-textMuted">Email Address</dt><dd className="mt-0.5 break-all text-sm font-medium text-textPrimary">{profile.email || user?.email || 'Not provided'}</dd></div></div>
        {field('Phone Number', 'phone', <Phone className="h-4 w-4" />)}{field('Specialty', 'specialization', <Stethoscope className="h-4 w-4" />)}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border"><div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0"><BadgeCheck className="h-4 w-4" /></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-textMuted">License Number / Verification</dt><dd className="mt-0.5 font-mono text-sm font-semibold text-textPrimary">{profile.licenseNumber || 'Not provided'} · {profile.doctorVerificationStatus || 'Pending review'}</dd></div></div>
      </dl>
      <div className="mt-6 flex justify-end gap-3">{editing ? <><button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold" onClick={() => setEditing(false)}>Cancel</button><button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button></> : <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => setEditing(true)}>Edit Profile</button>}</div>
    </Card></div></DashboardLayout>;
};
