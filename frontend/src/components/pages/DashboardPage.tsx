// Shows a quick, readable overview of today's clinic activity.
import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Calendar, CircleAlert, Users } from 'lucide-react';
import api from '../../shared/services/api';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface DashboardStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  appointmentsToday: number;
  criticalVitalsCount: number;
}

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const counter = { val: 0 };
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      ref.current.textContent = Math.round(value).toLocaleString();
      return;
    }

    const tween = gsap.to(counter, {
      val: value,
      duration: 0.8,
      ease: 'power1.out',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = Math.round(counter.val).toLocaleString();
      },
    });
    return () => {
      tween.kill();
    };
  }, [value]);

  return <span ref={ref}>0</span>;
};

const ArrowLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link to={to} className="dashboard-card-action" aria-label={label}>
    <span>{label}</span>
    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
  </Link>
);

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get('/dashboard/stats') as DashboardStats;
        setStats(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };
    void fetchStats();
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  return (
    <DashboardLayout>
      <div ref={containerRef}>
        <header className="mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-textSecondary">
            Overview
          </p>
          <h1 className="dashboard-title text-[36px] font-medium leading-tight text-textPrimary sm:text-[40px]">
            Today at the clinic
          </h1>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-primary">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-textSecondary">Loading statistics...</span>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-5 text-sm text-danger">
            {error}
          </div>
        )}

        {!loading && !error && !stats && (
          <div className="rounded-xl border border-textPrimary/10 bg-surface p-8 text-center text-sm text-textSecondary">
            No dashboard data found.
          </div>
        )}

        {!loading && stats && (
          <div className="dashboard-card-grid grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="dashboard-card dashboard-stat-card border-border hover:border-primary/20">
              <div className="dashboard-stat-icon bg-[#E6F4F1] text-[#0F4A44]"><Users className="h-5 w-5" aria-hidden="true" /></div>
              <p className="dashboard-stat-label">Total Patients</p>
              <p className="dashboard-stat-value"><AnimatedNumber value={stats.totalPatients} /></p>
              <ArrowLink to="/patients" label="View patients" />
            </Card>
            <Card className="dashboard-card dashboard-stat-card border-border hover:border-primary/20">
              <div className="dashboard-stat-icon bg-[#EAF3FA] text-[#0284C7]"><Calendar className="h-5 w-5" aria-hidden="true" /></div>
              <p className="dashboard-stat-label">Appointments Today</p>
              <p className="dashboard-stat-value"><AnimatedNumber value={stats.appointmentsToday} /></p>
              <ArrowLink to="/appointments" label="View appointments" />
            </Card>
            <Card className="dashboard-card dashboard-stat-card border-border hover:border-primary/20">
              <div className="dashboard-stat-icon bg-[#F4FDE0] text-[#0F4A44]"><Users className="h-5 w-5" aria-hidden="true" /></div>
              <p className="dashboard-stat-label">Doctors</p>
              <p className="dashboard-stat-value"><AnimatedNumber value={stats.totalDoctors} /></p>
              <ArrowLink to="/doctors" label="View doctors" />
            </Card>
            <Card className="dashboard-card dashboard-stat-card border-border hover:border-primary/20">
              <div className="dashboard-stat-icon bg-[#FDF0EE] text-[#D9534F]"><CircleAlert className="h-5 w-5" aria-hidden="true" /></div>
              <p className="dashboard-stat-label">Critical Alerts</p>
              <p className={`dashboard-stat-value ${stats.criticalVitalsCount > 0 ? 'text-range-out' : ''}`}><AnimatedNumber value={stats.criticalVitalsCount} /></p>
              <ArrowLink to="/vitals" label="Review alerts" />
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
