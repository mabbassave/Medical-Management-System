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
  const { speak, isSupported } = useSpeech();
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
    if (isDashboardWorkspace) {
      window.localStorage.setItem('doctor-sidebar-collapsed', String(desktopCollapsed));
    }
  }, [desktopCollapsed, isDashboardWorkspace]);

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
        <div className="app-sidebar-top flex h-16 items-center justify-between border-b border-slate-100 px-6">
          <div className="doctor-brand flex items-center gap-2.5">
            <AivoraLogo className="h-7 w-7" />
            <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center">
              MediCure
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#EAB308]" />
            </span>
          </div>
          {!isDashboardWorkspace && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <nav className="app-sidebar-nav relative flex-1 space-y-1.5 overflow-y-auto px-4 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-2.5 text-sm font-medium rounded-2xl transition-all ${
                    isActive
                      ? 'active bg-emerald-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
          <div className="app-sidebar-bottom space-y-2 border-t border-slate-100 px-4 py-4">
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
              <LogOut className="h-4 w-4 mr-3 shrink-0" aria-hidden="true" />
              Log out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="mx-4 mb-5 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        )}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`app-sidebar doctor-sidebar hidden shrink-0 flex-col border-r border-slate-200/70 bg-white transition-[width] duration-250 md:flex ${desktopCollapsed ? 'is-collapsed w-20' : 'w-64'}`}>
        <div className={`app-sidebar-top flex h-18 shrink-0 items-center justify-between border-b border-slate-100 ${desktopCollapsed ? 'px-2' : 'px-4'}`}>
          <div className="doctor-brand flex items-center gap-2.5">
            <AivoraLogo className="h-8 w-8 shrink-0" />
            {!desktopCollapsed && (
              <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center">
                MediCure
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#EAB308]" />
              </span>
            )}
          </div>
          {isDashboardWorkspace && (
            <button
              type="button"
              onClick={() => setDesktopCollapsed((collapsed) => !collapsed)}
              className="doctor-sidebar-toggle shrink-0"
              aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>

        <nav
          ref={navRef}
          className={`app-sidebar-nav relative flex-1 space-y-1.5 overflow-y-auto py-4 ${
            desktopCollapsed ? 'px-2' : 'px-4'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={desktopCollapsed ? item.label : undefined}
                aria-label={desktopCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-2xl py-2.5 text-sm font-medium transition-all ${
                    desktopCollapsed ? 'justify-center px-0' : 'px-3.5'
                  } ${
                    isActive
                      ? 'active bg-emerald-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
                role="link"
              >
                <Icon className={`h-4 w-4 shrink-0 ${
                  desktopCollapsed ? '' : 'mr-3'
                }`} />
                <span className={desktopCollapsed ? 'sr-only' : ''}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        {isDashboardWorkspace && (
          <div className={`app-sidebar-bottom doctor-sidebar-bottom space-y-2 border-t border-slate-100 py-4 ${
            desktopCollapsed ? 'px-2' : 'px-4'
          }`}>
            <NavLink
              to={isPatientWorkspace ? '/portal' : '/profile'}
              title={desktopCollapsed ? 'Profile' : undefined}
              aria-label={desktopCollapsed ? 'Profile' : undefined}
              className={`app-sidebar-footer-item ${desktopCollapsed ? 'justify-center px-0' : ''}`}
            >
              <UserRound className={`h-4 w-4 shrink-0 ${desktopCollapsed ? '' : 'mr-3'}`} aria-hidden="true" />
              <span className={desktopCollapsed ? 'sr-only' : ''}>Profile</span>
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              title={desktopCollapsed ? 'Log out' : undefined}
              aria-label="Log out"
              className={`app-sidebar-footer-item ${desktopCollapsed ? 'justify-center px-0' : ''}`}
            >
              <LogOut className={`h-4 w-4 shrink-0 ${desktopCollapsed ? '' : 'mr-3'}`} aria-hidden="true" />
              <span className={desktopCollapsed ? 'sr-only' : ''}>Log out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="app-main flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[#F8FAFC]">
        <header className={`app-header doctor-header flex h-18 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/95 backdrop-blur-md px-6 sm:px-8 ${isPatientWorkspace ? 'patient-header' : ''}`}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-controls="mobile-sidebar"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
              title={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
              className={`doctor-mobile-menu inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 md:hidden ${mobileOpen && isDashboardWorkspace ? 'doctor-mobile-menu-inside-sidebar' : ''}`}
            >
              {mobileOpen && isDashboardWorkspace ? <PanelLeftClose className="h-4 w-4" aria-hidden="true" /> : mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            </button>

            <div className="app-page-heading min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>
              <p className="mt-0.5 text-[11px] font-semibold tracking-wider text-emerald-600 uppercase">{isPatientWorkspace ? 'Patient Portal' : 'Clinical Workspace'}</p>
            </div>
          </div>

          {/* Top Bar Search & Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="hidden lg:flex items-center relative max-w-xs w-64">
              <input
                type="text"
                placeholder="Search patients, records..."
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all"
              />
            </div>

            {!isDoctorWorkspace && (
              <div className="flex flex-col items-start">
                <button
                  type="button"
                  aria-pressed={autoAlerts}
                  disabled={!isSupported}
                  onClick={() => setAutoAlerts(!autoAlerts)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    autoAlerts
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {autoAlerts ? <Volume2 className="h-3.5 w-3.5 text-emerald-600" /> : <VolumeX className="h-3.5 w-3.5 text-slate-400" />}
                  <span>Alerts {autoAlerts ? 'On' : 'Off'}</span>
                </button>
              </div>
            )}

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="max-w-32 text-right text-xs sm:max-w-48">
                <p className="font-bold text-slate-900 truncate">
                  {user?.name || user?.username || 'Staff Member'}
                </p>
                <span
                  className="mt-0.5 inline-block rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800"
                >
                  {user?.role || 'clinical'}
                </span>
              </div>
              <div className="app-user-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-emerald-50 text-emerald-700 font-bold shadow-xs" aria-hidden="true">
                <UserIcon className="h-5 w-5" />
              </div>
            </div>

            {user && ['patient', 'doctor'].includes(user.role.toLowerCase()) && !isDoctorWorkspace && (
                <button
                  type="button"
                  onClick={() => navigate('/face-enrollment-prompt')}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <ScanFace className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span>Face sign-in</span>
                </button>
              )}
            {!isDoctorWorkspace && !isPatientWorkspace && (
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
