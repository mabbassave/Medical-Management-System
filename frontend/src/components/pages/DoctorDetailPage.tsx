import React, { useRef,  useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Stethoscope, Award } from 'lucide-react';
import api from '../../shared/services/api';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface DoctorDetails { doctorId: string; firstName: string; lastName: string; fullName?: string; email: string; phone: string; specialization: string; }

export const DoctorDetailPage: React.FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const [doctor, setDoctor] = useState<DoctorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId) return;
    const fetch = async () => {
      try {
        const res = await api.get(`/doctors/${doctorId}`) as { data?: DoctorDetails } | DoctorDetails;
        setDoctor((res as { data?: DoctorDetails }).data || res as DoctorDetails);
      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load doctor profile'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [doctorId]);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="max-w-3xl mx-auto">
          <Link
            to="/doctors"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary hover:text-primary transition-colors mb-6 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Doctors List
          </Link>

          {loading && (
            <div className="flex items-center justify-center py-24 text-primary">
              <Spinner size="lg" />
              <span className="ml-3 text-sm font-medium text-textSecondary">Loading physician profile...</span>
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
              {error}
            </div>
          )}

          {!loading && !error && !doctor && (
            <Card className="p-12 text-center rounded-2xl border border-border bg-surface">
              <p className="text-textSecondary text-sm font-medium">No doctor profile found.</p>
            </Card>
          )}

          {!loading && doctor && (
            <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-border">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
                  <Stethoscope className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight text-textPrimary">
                    Dr. {doctor.fullName || `${doctor.firstName} ${doctor.lastName}`}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      {doctor.specialization}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-700">
                      ID: {doctor.doctorId}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
                  <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-textSecondary shrink-0">
                    <Award className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-textMuted">Doctor ID</p>
                    <p className="text-sm font-mono font-semibold text-textPrimary mt-0.5">{doctor.doctorId}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
                  <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-textSecondary shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-textMuted">Email Address</p>
                    <p className="text-sm font-medium text-textPrimary mt-0.5 break-all">{doctor.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
                  <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-textSecondary shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-textMuted">Phone Number</p>
                    <p className="text-sm font-medium text-textPrimary mt-0.5">{doctor.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
