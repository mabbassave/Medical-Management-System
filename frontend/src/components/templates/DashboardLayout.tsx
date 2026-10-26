// Provides shared navigation and optional spoken critical alerts.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Calendar,
  Activity,
  FileText,
  CreditCard,
  Pill,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  ClipboardList,
  FlaskConical,
  Receipt,
  Volume2,
  VolumeX,
  ScanFace,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAlerts } from '../../shared/hooks/useAlerts';
import { ANIMATION } from '../../shared/utils/constants';
import { socket } from '../../shared/services/socket';
import { useSpeech } from '../../shared/hooks/useSpeech';
import { useVoiceStore } from '../../store/voiceStore';
import { AivoraLogo } from '../atoms/AivoraLogo';
import './DoctorDashboard.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const isDoctorWorkspace = user?.role?.toLowerCase() === 'doctor';
  const isPatientWorkspace = user?.role?.toLowerCase() === 'patient';
  const isDashboardWorkspace = isDoctorWorkspace || isPatientWorkspace;
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const activeBarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('doctor-sidebar-collapsed') === 'true'
  );
  const isInitialMount = useRef(true);
  const autoAlerts = useVoiceStore((state) => state.autoAlerts);
  const setAutoAlerts = useVoiceStore((state) => state.setAutoAlerts);
  const { speak, isSupported, message: speechMessage } = useSpeech();
  const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
  const routeTitles: Record<string, string> = {
    '/dashboard': 'Dashboard', '/patients': 'My Patients', '/appointments': 'My Appointments',
    '/vitals': 'AI Vitals Scan', '/prescriptions': 'Prescriptions', '/medical-records': 'Medical Records',
    '/lab-reports': 'Reports', '/billing': 'Billing', '/profile': 'Profile',
    '/portal': 'My Profile', '/doctors': 'Doctors', '/pharmacy': 'Pharmacy',
  };
  const currentRoute = Object.keys(routeTitles)
    .filter((path) => normalizedPath === path || normalizedPath.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
  const pageTitle = currentRoute ? routeTitles[currentRoute] : 'Dashboard';

  useEffect(() => {
    if (isDoctorWorkspace) {
      window.localStorage.setItem('doctor-sidebar-collapsed', String(desktopCollapsed));
    }
  }, [desktopCollapsed, isDoctorWorkspace]);

  useAlerts();

  useEffect(() => {
    if (!autoAlerts || isDoctorWorkspace) return;
    const handleVoiceNotification = (data: unknown) => {
      const notification = data && typeof data === 'object'
        ? data as Record<string, unknown>
        : null;
      const alertText = typeof data === 'string'
        ? data
        : typeof notification?.message === 'string'
          ? notification.message
          : '';
      const critical = notification?.type === 'critical' || alertText.toLowerCase().includes('critical');
      if (!critical || !alertText) return;

      const nestedPatient = notification?.patient && typeof notification.patient === 'object'
        ? notification.patient as Record<string, unknown>
        : null;
      const nestedPatientName = nestedPatient
        ? [nestedPatient.firstName, nestedPatient.lastName]
          .filter((part): part is string => typeof part === 'string')
          .join(' ')
        : '';
      const directName = typeof notification?.patientName === 'string'
        ? notification.patientName
        : typeof nestedPatient?.fullName === 'string'
          ? nestedPatient.fullName
          : typeof nestedPatient?.name === 'string'
            ? nestedPatient.name
            : nestedPatientName;
      const nameFromText =
        /patient(?: name)?\s*[:=-]\s*([A-Za-z][A-Za-z\s'-]+)/i.exec(alertText)?.[1]?.trim()
        || /\bfor\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)?)/.exec(alertText)?.[1]?.trim();
      const patientName = directName || nameFromText;
      const englishAlert = patientName
        ? `Critical notification for ${patientName}. ${alertText}`
        : `Critical notification. ${alertText}`;
      const language = useVoiceStore.getState().language;
      const spokenAlert = language === 'ur'
        ? patientName
          ? `مریض ${patientName} کے لیے تشویشناک اطلاع۔`
          : 'تشویشناک طبی اطلاع موصول ہوئی۔'
        : englishAlert;
      speak(spokenAlert, language, englishAlert);
    };

    socket.on('notification', handleVoiceNotification);
    return () => {
      socket.off('notification', handleVoiceNotification);
    };
  }, [autoAlerts, isDoctorWorkspace, speak]);

  // Content fade-in on mount and route changes
  useEffect(() => {
    if (!contentRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const duration = isInitialMount.current
      ? ANIMATION.LAYOUT.INITIAL_DURATION
      : ANIMATION.LAYOUT.ROUTE_DURATION;
    isInitialMount.current = false;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: ANIMATION.LAYOUT.INITIAL_Y },
        {
          opacity: 1,
          y: 0,
          duration,
          ease: ANIMATION.EASING.GSAP,
        }
      );
    }, contentRef);

    return () => ctx.revert();
  }, [location.pathname]);

  // Sidebar active indicator animation
  useEffect(() => {
    const activeLink = navRef.current?.querySelector('a.active') as HTMLElement | null;
    if (!activeLink || !activeBarRef.current) return;

    const top = activeLink.offsetTop;
    const height = activeLink.offsetHeight;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(activeBarRef.current, { y: top, height, opacity: 1 });
      } else {
        gsap.to(activeBarRef.current, {
          y: top,
          height,
          opacity: 1,
          duration: ANIMATION.ACTIVE_BAR.DURATION,
          ease: ANIMATION.EASING.GSAP,
        });
      }
    });

    return () => ctx.revert();
  }, [location.pathname]);

  // Mobile sidebar open/close animation
  useEffect(() => {
    if (!overlayRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (mobileOpen) {
        overlayRef.current!.style.display = 'block';
        if (prefersReducedMotion) {
          gsap.set(overlayRef.current, { opacity: 1 });
        } else {
          gsap.to(overlayRef.current, {
            opacity: 1,
            duration: ANIMATION.SIDEBAR.DURATION,
            ease: ANIMATION.EASING.GSAP,
          });
        }
      } else {
        if (prefersReducedMotion) {
          gsap.set(overlayRef.current, { opacity: 0 });
          overlayRef.current!.style.display = 'none';
        } else {
          gsap.to(overlayRef.current, {
            opacity: 0,
            duration: ANIMATION.SIDEBAR.DURATION,
            ease: ANIMATION.EASING.GSAP,
            onComplete: () => {
              if (overlayRef.current) overlayRef.current.style.display = 'none';
            },
          });
        }
      }
    });

    return () => ctx.revert();
  }, [mobileOpen]);

  // ─── Role-based navigation ────────────────────────────────────────────────
  const navItems = useMemo(() => {
    const role = user?.role?.toLowerCase();

    if (role === 'doctor') {
      return [
        { label: 'Dashboard',        path: '/dashboard',      icon: LayoutDashboard },
        { label: 'Patients',         path: '/patients',       icon: Users            },
        { label: 'Appointments',     path: '/appointments',   icon: Calendar         },
        { label: 'AI Vitals Scan',   path: '/vitals',         icon: Activity         },
        { label: 'Doctors',          path: '/doctors',        icon: Stethoscope      },
        { label: 'Prescriptions',    path: '/prescriptions',  icon: FileText         },
        { label: 'Medical Records',  path: '/medical-records',icon: ClipboardList    },
        { label: 'Reports',          path: '/lab-reports',    icon: FlaskConical     },
        { label: 'Billing',          path: '/billing',        icon: CreditCard       },
        { label: 'Manage Face Scan', path: '/face-enrollment-prompt', icon: ScanFace },
      ];
    }

    if (role === 'patient') {
      return [
        { label: 'My Profile',       path: '/portal',         icon: UserIcon         },
        { label: 'My Appointments',  path: '/appointments',   icon: Calendar         },
        { label: 'AI Vitals Scan',   path: '/vitals',         icon: Activity         },
        { label: 'My Prescriptions', path: '/prescriptions',  icon: FileText         },
        { label: 'My Medical Records', path: '/medical-records', icon: ClipboardList },
        { label: 'My Reports',       path: '/lab-reports',    icon: FlaskConical     },
        { label: 'My Bills',         path: '/billing',        icon: Receipt          },
        { label: 'Manage Face Scan', path: '/face-enrollment-prompt', icon: ScanFace },
      ];
    }

    // Default: admin (or any unrecognized role) sees everything
    return [
      { label: 'Dashboard',      path: '/dashboard',       icon: LayoutDashboard },
      { label: 'Patients',       path: '/patients',        icon: Users            },
      { label: 'Appointments',   path: '/appointments',    icon: Calendar         },
      { label: 'Doctors',        path: '/doctors',         icon: Stethoscope      },
      { label: 'Prescriptions',  path: '/prescriptions',   icon: FileText         },
      { label: 'Medical Records',path: '/medical-records', icon: ClipboardList    },
      { label: 'Reports',        path: '/lab-reports',     icon: FlaskConical     },
      { label: 'Billing',        path: '/billing',         icon: CreditCard       },
      { label: 'Pharmacy',       path: '/pharmacy',        icon: Pill             },
    ];
  }, [user?.role]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleLogout = () => {

    logout();
    navigate('/');
  };

  return (
    <div className="app-workspace doctor-workspace h-dvh overflow-hidden flex bg-background">
      {/* Mobile sidebar overlay */}
      <div
        ref={overlayRef}
        onClick={() => setMobileOpen(false)}
        className="fixed inset-0 bg-textPrimary/40 z-40 md:hidden"
        style={{ display: 'none', opacity: 0 }}
      />

      {/* Mobile sidebar */}
      <aside
        id="mobile-sidebar"
        className={`${isDashboardWorkspace ? 'app-sidebar doctor-sidebar ' : ''}fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-textPrimary/10 bg-surface transition-transform duration-300 ease-out md:hidden`}
        style={{ transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <div className="app-sidebar-top flex h-16 items-center justify-between border-b border-textPrimary/10 px-6">
          <div className="doctor-brand"><AivoraLogo className="h-8 w-8" /><span>Medivanta</span></div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-md text-textSecondary hover:text-textPrimary"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="app-sidebar-nav relative flex-1 space-y-1 overflow-y-auto px-4 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    isActive
                      ? 'active bg-primary text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-3 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        {isDashboardWorkspace ? (
          <div className="app-sidebar-bottom space-y-2 border-t border-textPrimary/10 px-4 py-4">
            <NavLink
              to={isPatientWorkspace ? '/portal' : '/profile'}
              onClick={() => setMobileOpen(false)}
              className="app-sidebar-footer-item"
            >
              <UserRound className="mr-3 h-4 w-4 shrink-0" aria-hidden="true" />
              Profile
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="app-sidebar-footer-item"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="mx-4 mb-5 flex items-center justify-center gap-2 rounded-md border border-textPrimary/10 px-4 py-3 text-sm font-medium text-textPrimary hover:bg-background"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        )}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`app-sidebar doctor-sidebar hidden shrink-0 flex-col border-r border-textPrimary/10 bg-surface transition-[width] duration-200 md:flex ${desktopCollapsed ? 'is-collapsed' : ''}`}>
        <div className={`app-sidebar-top flex h-16 items-center justify-between border-b border-textPrimary/10 ${desktopCollapsed ? 'px-2' : 'px-4'}`}>
          <div className="doctor-brand min-w-0"><AivoraLogo className="h-8 w-8 shrink-0" /><span className={desktopCollapsed ? 'sr-only' : ''}>Medivanta</span></div>
          {isDashboardWorkspace && (
          <button
            type="button"
            onClick={() => setDesktopCollapsed((collapsed) => !collapsed)}
            className="doctor-sidebar-toggle"
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!desktopCollapsed}
            title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {desktopCollapsed
              ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
          </button>
          )}
        </div>
        <nav
          ref={navRef}
          className={`app-sidebar-nav relative flex-1 space-y-1 overflow-y-auto py-3 ${
            isDoctorWorkspace && desktopCollapsed ? 'px-2' : 'px-4'
          }`}
        >
          {/* Active 2px indicator bar */}
          <div
            ref={activeBarRef}
            className="absolute left-0 w-[2px] bg-primary rounded-r pointer-events-none"
            style={{ top: 0, height: 0, opacity: 0 }}
          />
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isDashboardWorkspace && desktopCollapsed ? item.label : undefined}
                aria-label={isDashboardWorkspace && desktopCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-xl py-2.5 text-sm font-medium transition-all ${
                    isDashboardWorkspace && desktopCollapsed ? 'justify-center px-0' : 'px-3.5'
                  } ${
                    isActive
                      ? 'active bg-primary text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`
                }
                role="link"
              >
                <Icon className={`h-4 w-4 shrink-0 ${
                  isDashboardWorkspace && desktopCollapsed ? '' : 'mr-3'
                }`} />
                <span className={isDashboardWorkspace && desktopCollapsed ? 'sr-only' : ''}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        {isDashboardWorkspace && (
          <div className={`app-sidebar-bottom doctor-sidebar-bottom space-y-2 border-t border-textPrimary/10 py-4 ${
            desktopCollapsed ? 'px-2' : 'px-4'
          }`}>
            <NavLink
              to={isPatientWorkspace ? '/portal' : '/profile'}
              title={desktopCollapsed ? 'Profile' : undefined}
              aria-label={desktopCollapsed ? 'Profile' : undefined}
              className="app-sidebar-footer-item"
            >
              <UserRound className={`h-4 w-4 shrink-0 ${desktopCollapsed ? '' : 'mr-3'}`} aria-hidden="true" />
              <span className={desktopCollapsed ? 'sr-only' : ''}>Profile</span>
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              title={desktopCollapsed ? 'Log out' : undefined}
              aria-label="Log out"
              className="app-sidebar-footer-item"
            >
              <LogOut className={`h-4 w-4 shrink-0 ${desktopCollapsed ? '' : 'mr-3'}`} aria-hidden="true" />
              <span className={desktopCollapsed ? 'sr-only' : ''}>Log out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="app-main flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        <header className={`app-header doctor-header flex h-20 shrink-0 items-center justify-between border-b border-border/80 bg-surface/90 backdrop-blur-xl px-6 sm:px-8 ${isPatientWorkspace ? 'patient-header' : ''}`}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-controls="mobile-sidebar"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="doctor-mobile-menu md:hidden"
            >
              {mobileOpen
                ? <X className="h-4 w-4" aria-hidden="true" />
                : <Menu className="h-4 w-4" aria-hidden="true" />}
            </button>
            <div className="app-page-heading min-w-0">
              <h1 className="truncate text-xl sm:text-2xl font-bold tracking-tight text-textPrimary">{pageTitle}</h1>
              <p className="mt-0.5 text-[11px] font-semibold tracking-wider text-primary uppercase">{isPatientWorkspace ? 'Patient Portal' : 'Clinical Workspace'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-4">
            {!isDoctorWorkspace && (
              <div className="flex flex-col items-start">
                <button
                  type="button"
                  aria-pressed={autoAlerts}
                  disabled={!isSupported}
                  onClick={() => setAutoAlerts(!autoAlerts)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    autoAlerts
                      ? 'border-primary/40 bg-primary/15 text-primary shadow-sm shadow-primary/20'
                      : 'border-border bg-surfaceElevated text-textSecondary hover:text-textPrimary'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {autoAlerts ? <Volume2 className="h-3.5 w-3.5 text-primary" /> : <VolumeX className="h-3.5 w-3.5 text-textMuted" />}
                  <span>Voice alerts {autoAlerts ? 'On' : 'Off'}</span>
                </button>
                <span role="status" className="mt-0.5 max-w-44 text-[10px] text-textMuted">
                  {speechMessage || (isSupported
                    ? 'Critical notifications only'
                    : 'Speech not supported')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="max-w-32 text-right text-xs sm:max-w-48">
                <p className="font-bold text-textPrimary truncate">
                  {user?.name || user?.username || 'Staff Member'}
                </p>
                <span
                  className="mt-0.5 inline-block rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-800"
                >
                  {user?.role || 'clinical'}
                </span>
              </div>
              <div className="app-user-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surfaceElevated text-primary shadow-inner" aria-hidden="true">
                <UserIcon className="h-5 w-5" />
              </div>
            </div>
            {user && ['patient', 'doctor'].includes(user.role.toLowerCase()) && !isDoctorWorkspace && (
                <button
                  type="button"
                  onClick={() => navigate('/face-enrollment-prompt')}
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  <ScanFace className="h-4 w-4" aria-hidden="true" />
                  <span>Face sign-in</span>
                </button>
              )}
            {!isDoctorWorkspace && (
              <button
                type="button"
                onClick={() => navigate(user?.role?.toLowerCase() === 'patient' ? '/portal' : '/dashboard')}
                aria-label="Open profile"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surfaceElevated text-textSecondary hover:text-textPrimary hover:border-primary/40 transition-colors"
              >
                <UserIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {!isDoctorWorkspace && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surfaceElevated text-textSecondary hover:text-rose-400 hover:border-rose-500/40 transition-colors md:flex"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
            )}
          </div>
        </header>
        <main
          ref={contentRef}
          className="app-content doctor-workspace-content min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-8"
        >
          <div className="app-content-shell mx-auto w-full max-w-[1200px] doctor-content-shell">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
