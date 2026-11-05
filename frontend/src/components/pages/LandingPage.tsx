import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  HeartPulse,
  Home,
  Info,
  LayoutGrid,
  Lightbulb,
  Menu,
  Pill,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  User,
  X,
  Stethoscope,
  Heart,
  Shield,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AivoraLogo } from '../atoms/AivoraLogo';
import './LandingPage.css';

const FaceScanModel = lazy(() =>
  import('./FaceScanModel').then(({ FaceScanModel: m }) => ({ default: m }))
);

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const setupRepeatableReveal = (
  element: HTMLElement,
  y: number,
  duration: number,
  delay = 0,
  initialScale = 1
) => {
  gsap.set(element, { y, autoAlpha: 0, scale: initialScale });

  let activeTween: gsap.core.Tween | undefined;
  const enter = (direction: 1 | -1) => {
    activeTween?.kill();
    gsap.set(element, { y: y * direction, autoAlpha: 0, scale: initialScale });
    activeTween = gsap.to(element, {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      duration,
      delay,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };
  const leave = (direction: 1 | -1) => {
    activeTween?.kill();
    activeTween = gsap.to(element, {
      y: y * direction,
      autoAlpha: 0,
      duration: 0.3,
      ease: 'power2.in',
      overwrite: 'auto',
    });
  };

  const trigger = ScrollTrigger.create({
    trigger: element,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: () => enter(1),
    onLeave: () => leave(-1),
    onEnterBack: () => enter(-1),
    onLeaveBack: () => leave(1),
  });

  const rect = element.getBoundingClientRect();
  if (rect.bottom > 0 && rect.top < window.innerHeight) {
    enter(trigger.direction < 0 ? -1 : 1);
  }
};

const navItems = [
  { label: 'Home', href: '#top', icon: Home, active: true },
  { label: 'Platform', href: '#platform', icon: LayoutGrid },
  { label: 'Solutions', href: '#solutions', icon: Lightbulb },
  { label: 'About', href: '#about', icon: Info },
];

export const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<'vitals' | 'records' | 'appointments'>('vitals');

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const navLinksRef = useRef<HTMLDivElement>(null);
  const navActionsRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setIsMenuOpen(false);

  useLayoutEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY >= 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP Entrance & ScrollTrigger Animations
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const navTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (headerRef.current) {
        navTl.fromTo(headerRef.current, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 });
      }

      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      heroTl
        .fromTo('.gsap-hero-title', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65 })
        .fromTo('.gsap-hero-desc', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, '-=0.4')
        .fromTo('.gsap-hero-actions > *', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.1 }, '-=0.35')
        .fromTo('.gsap-hero-trust > *', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, stagger: 0.05 }, '-=0.25');

      gsap.fromTo(
        '.gsap-hero-visual',
        { y: 30, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.75, ease: 'power2.out', delay: 0.15 }
      );

      gsap.utils.toArray<HTMLElement>(
        '#about .section-header, #solutions .section-header, #how-it-works-section .section-header, #platform .section-header, #benefits-section .section-header, #final-cta-content, footer .footer-col',
        mainContainerRef.current
      ).forEach((element, index) => {
        setupRepeatableReveal(element, 24, 0.5, element.matches('footer .footer-col') ? (index % 4) * 0.08 : 0);
      });
    }, mainContainerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const cardSelectors = ['.value-card', '.gsap-feature-card', '.gsap-step-item', '.benefit-card'];
      cardSelectors.forEach((selector) => {
        gsap.utils.toArray<HTMLElement>(selector, mainContainerRef.current).forEach((card, index) => {
          setupRepeatableReveal(card, 20, 0.5, (index % 4) * 0.08);
        });
      });
    }, mainContainerRef);

    return () => ctx.revert();
  }, []);

  // Mobile menu transitions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        closeMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      if (mobileMenuRef.current) {
        gsap.fromTo(mobileMenuRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  return (
    <div ref={mainContainerRef} id="top" className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">

      {/* ── TOP NAVBAR ── */}
      <div
        className={`medicure-nav-wrapper fixed inset-x-0 top-0 z-50 w-full pointer-events-none ${
          isScrolled ? 'scrolled' : ''
        }`}
      >
        <header
          ref={headerRef}
          className="medicure-nav-header pointer-events-auto"
        >
          <div className="medicure-nav-inner flex h-full items-center justify-between">
            {/* Left: MediCure Logo */}
            <a
              ref={logoRef}
              href="#top"
              aria-label="MediCure Home"
              className="group inline-flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <AivoraLogo className="h-8 w-8 transition-transform group-hover:scale-105" />
              <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center">
                MediCure
                <span className="ml-1 h-2 w-2 rounded-full bg-[#EAB308]" />
              </span>
            </a>

            {/* Center: Navigation Links */}
            <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
              <div ref={navLinksRef} className="flex items-center gap-1">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 transition-all hover:text-emerald-700 hover:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </nav>

            {/* Right: Actions */}
            <div ref={navActionsRef} className="hidden items-center gap-2.5 md:flex">
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:text-slate-900 hover:bg-slate-100/80"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-xs font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-xs active:scale-95"
              >
                <span>Book an appointment</span>
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>
      </div>

      {/* ── MOBILE MENU OVERLAY ── */}
      {isMenuOpen && (
        <div
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-[100] flex flex-col h-[100dvh] w-screen bg-white text-slate-900 px-6 py-6 md:hidden"
        >
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <a href="#top" onClick={closeMenu} className="inline-flex items-center gap-2.5">
              <AivoraLogo className="h-8 w-8" />
              <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center">
                MediCure
                <span className="ml-1 h-2 w-2 rounded-full bg-[#EAB308]" />
              </span>
            </a>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 py-8 flex flex-col justify-center space-y-4">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className="text-2xl font-bold text-slate-800 transition-colors hover:text-emerald-600"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-3 pb-4">
            <Link
              to="/login"
              onClick={closeMenu}
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-300 text-sm font-semibold text-slate-800"
            >
              Log in
            </Link>
            <Link
              to="/register"
              onClick={closeMenu}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 text-sm font-semibold text-white shadow-md"
            >
              Book an appointment
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── SECTION: MAIN HERO CONTAINER ── */}
      <main ref={heroSectionRef} className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="medicure-hero-container relative mx-auto max-w-[1360px] p-6 sm:p-10 lg:p-14 bg-white overflow-hidden">
          
          {/* Subtle curved background decorative shape (solid green accent) */}
          <div 
            className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full border border-[#148F3A]/10 opacity-70"
            aria-hidden="true" 
          />

          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 relative z-10">

            {/* Left Side: Headline, Paragraph, Buttons, Trust Indicators */}
            <div className="flex flex-col items-start">
              
              {/* Modern Clinical Healthcare Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-4 py-1.5 text-xs font-semibold text-emerald-800 mb-6">
                <span className="h-2 w-2 rounded-full bg-[#148F3A]" />
                <span>Modern Clinical Healthcare</span>
              </div>

              {/* Headline with "health" and "wellness" highlighted in solid green #148F3A */}
              <h1 className="gsap-hero-title text-[clamp(36px,5vw,56px)] font-bold leading-[1.1] tracking-tight text-[#0F172A]">
                Expert care for your <span className="text-[#148F3A]">health</span> and <span className="text-[#148F3A]">wellness</span>.
              </h1>

              {/* Supporting description */}
              <p className="gsap-hero-desc mt-5 text-base sm:text-lg leading-relaxed text-slate-600 max-w-xl">
                Personalized, comprehensive medical services designed for you and your loved ones. Experience compassionate doctors, rapid diagnostics, and connected clinical care.
              </p>

              {/* Action Buttons: Solid Green Book an Appointment + White Get Started */}
              <div className="gsap-hero-actions mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/register"
                  className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-[#148F3A] px-7 text-sm font-semibold text-white transition-all hover:bg-[#117a32] hover:shadow-[0_6px_20px_rgba(20,143,58,0.28)] active:scale-95"
                >
                  <span>Book an Appointment</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-7 text-sm font-semibold text-[#0F172A] transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 shadow-xs"
                >
                  <span>Get Started</span>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="gsap-hero-trust mt-10 pt-8 border-t border-slate-100 w-full flex flex-wrap items-center gap-6 sm:gap-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#148F3A] shrink-0 border border-emerald-100">
                    <ShieldCheck className="h-5 w-5 text-[#148F3A]" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-[#0F172A] leading-tight">100%</span>
                    <span className="text-xs font-medium text-slate-500">Trusted Care</span>
                  </div>
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-200" aria-hidden="true" />

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#148F3A] shrink-0 border border-emerald-100">
                    <Users className="h-5 w-5 text-[#148F3A]" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-[#0F172A] leading-tight">50K+</span>
                    <span className="text-xs font-medium text-slate-500">Happy Patients</span>
                  </div>
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-200" aria-hidden="true" />

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#148F3A] shrink-0 border border-emerald-100">
                    <Clock className="h-5 w-5 text-[#148F3A]" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-[#0F172A] leading-tight">24/7</span>
                    <span className="text-xs font-medium text-slate-500">Medical Support</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Side: Doctor Visual + Solid Green Circle + Floating Badges + Heart Rate Card */}
            <div className="gsap-hero-visual relative mx-auto w-full max-w-[540px]">
              
              {/* Minimal green dotted matrix decoration */}
              <div className="absolute -top-6 -right-6 w-24 h-24 pointer-events-none z-0" aria-hidden="true">
                <svg className="w-full h-full text-[#148F3A]/25" viewBox="0 0 96 96" fill="currentColor">
                  <pattern id="hero-dots-pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="3" r="1.5" />
                  </pattern>
                  <rect width="96" height="96" fill="url(#hero-dots-pattern)" />
                </svg>
              </div>

              {/* Solid green decorative circular element behind the image */}
              <div 
                className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-44 h-44 sm:w-60 sm:h-60 rounded-full bg-[#148F3A] z-0" 
                aria-hidden="true"
              />

              {/* Subtle decorative curved shape */}
              <div 
                className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full border-2 border-[#148F3A]/20 pointer-events-none z-0" 
                aria-hidden="true"
              />

              {/* Main Doctor Image Container */}
              <div
                ref={heroVisualRef}
                className="relative z-10 overflow-hidden rounded-[2.5rem] bg-white p-3 border border-slate-200/90 shadow-[0_20px_45px_-10px_rgba(15,23,42,0.08)]"
              >
                <div className="relative aspect-[1.08/1] overflow-hidden rounded-[2rem] bg-slate-50">
                  {/* Doctor Image preserved without gradients */}
                  <img
                    src="/doctor-hero.jpg"
                    alt="Healthcare professional providing expert medical care"
                    className="h-full w-full object-cover object-[center_30%]"
                    fetchPriority="high"
                  />

                  {/* Floating White Badges (Expertise, Wellness, Care) */}
                  <div className="floating-label-badge top-5 left-5">
                    <Stethoscope className="h-4 w-4 text-[#148F3A]" />
                    <span>Expertise</span>
                  </div>

                  <div className="floating-label-badge top-5 right-5">
                    <Heart className="h-4 w-4 text-[#148F3A]" />
                    <span>Wellness</span>
                  </div>

                  <div className="floating-label-badge top-24 right-5">
                    <Shield className="h-4 w-4 text-[#148F3A]" />
                    <span>Care</span>
                  </div>

                  {/* Floating Heart Rate Card */}
                  <div className="floating-heart-rate-card">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#148F3A] shrink-0 border border-emerald-100">
                        <HeartPulse className="h-5 w-5 text-[#148F3A]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500">Heart Rate</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#148F3A] animate-pulse" />
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-bold text-[#0F172A]">72</span>
                          <span className="text-xs font-medium text-slate-400">bpm</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini SVG Heart Rate waveform sparkline */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-4">
                      <svg className="w-28 h-6 text-[#148F3A]" viewBox="0 0 110 24" fill="none">
                        <path
                          d="M2 12h20l4-7 6 15 5-11 5 7 4-4h20l4-6 5 13 4-10 4 7 4-4h20"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-[11px] font-semibold text-[#148F3A] bg-emerald-50 px-2 py-0.5 rounded-full">
                        Normal
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>

          {/* Thin heartbeat decorative line near the bottom */}
          <div className="mt-12 pt-6 border-t border-slate-100 w-full flex items-center justify-between text-xs text-slate-400 overflow-hidden" aria-hidden="true">
            <svg className="h-5 w-full text-[#148F3A]/30" viewBox="0 0 900 20" fill="none" preserveAspectRatio="none">
              <path
                d="M0 10 H300 L310 3 L320 17 L328 5 L336 13 L342 8 L350 10 H550 L560 3 L570 17 L578 5 L586 13 L592 8 L600 10 H900"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

        </div>
      </main>

      {/* ── AI FACE SCAN SECTION ── */}
      <section id="ai-scan" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* Left: 3D Model Display */}
            <div className="relative rounded-[2.5rem] border border-slate-200/80 shadow-[0_10px_40px_rgba(0,0,0,0.04)] bg-white overflow-hidden min-h-[500px] sm:min-h-[560px] lg:min-h-[620px] flex items-center justify-center">
              <Suspense fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-white">
                  <div className="h-8 w-8 rounded-full border-2 border-[#148F3A] border-t-transparent animate-spin" />
                </div>
              }>
                <div className="absolute inset-0">
                  <FaceScanModel followPointer normalizeSize scaleMultiplier={1.08} />
                </div>
              </Suspense>

              {/* Scan Progress Card (Top-Left) */}
              <div className="absolute top-5 left-5 z-20 bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.06)] rounded-2xl p-3.5 flex flex-col gap-2 min-w-[160px]">
                <div className="text-xs font-bold text-[#0F172A]">Scan Progress</div>
                <div className="flex items-center gap-3">
                  {/* Circular Progress Ring */}
                  <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="#148F3A"
                        strokeWidth="3"
                        strokeDasharray="87.96"
                        strokeDashoffset="19.35"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xs font-extrabold text-[#0F172A]">78%</span>
                  </div>
                  {/* Status label + mini bars */}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-500">Analyzing face...</span>
                    <div className="flex items-end gap-0.5 mt-1 h-3.5">
                      {[40, 75, 100, 60, 85, 45, 90, 55, 70].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-[#148F3A] rounded-full animate-pulse"
                          style={{ height: `${h}%`, animationDelay: `${i * 120}ms`, animationDuration: '1.2s' }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Scan Status (Top-Right) */}
              <div className="absolute top-5 right-5 z-20 inline-flex items-center gap-2 bg-white border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] rounded-full px-3.5 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#148F3A] animate-pulse" />
                <span className="text-xs font-semibold text-[#0F172A]">Live Scan</span>
              </div>

              {/* In-Memory Encrypted (Bottom-Left) */}
              <div className="absolute bottom-5 left-5 z-20 hidden sm:inline-flex items-center gap-2 bg-white border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] rounded-full px-3.5 py-1.5">
                <svg className="w-4 h-4 text-[#148F3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="text-xs font-semibold text-[#0F172A]">In-Memory Encrypted</span>
              </div>

              {/* Biometric Analysis (Bottom-Right) */}
              <div className="absolute bottom-5 right-5 z-20 inline-flex items-center gap-2 bg-white border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] rounded-full px-3.5 py-1.5">
                <svg className="w-4 h-4 text-[#148F3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="7" />
                  <circle cx="12" cy="12" r="2.5" />
                  <line x1="12" y1="2" x2="12" y2="5" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="5" y2="12" />
                  <line x1="19" y1="12" x2="22" y2="12" />
                </svg>
                <span className="text-xs font-semibold text-[#0F172A]">Biometric Analysis</span>
                <span className="h-2 w-2 rounded-full bg-[#148F3A]" />
              </div>
            </div>

            {/* Right: Biometric Information */}
            <div className="flex flex-col justify-center py-2 sm:py-4">
              {/* AI-Powered Biometric Analysis Tag */}
              <div className="inline-flex items-center gap-2.5 self-start bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-full px-3.5 py-1.5">
                <div className="w-5 h-5 rounded-md bg-[#148F3A] flex items-center justify-center text-white">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <rect x="9" y="9" width="6" height="6" />
                    <line x1="9" y1="1" x2="9" y2="4" />
                    <line x1="15" y1="1" x2="15" y2="4" />
                    <line x1="9" y1="20" x2="9" y2="23" />
                    <line x1="15" y1="20" x2="15" y2="23" />
                    <line x1="20" y1="9" x2="23" y2="9" />
                    <line x1="20" y1="14" x2="23" y2="14" />
                    <line x1="1" y1="9" x2="4" y2="9" />
                    <line x1="1" y1="14" x2="4" y2="14" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-[#0F172A]">AI-Powered Biometric Analysis</span>
              </div>

              {/* Heading */}
              <h2 className="mt-4 text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-[#0F172A] leading-[1.08]">
                Instant Patient <br />
                <span className="text-[#148F3A]">Identity.</span>
              </h2>

              {/* Description */}
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600 max-w-xl">
                Our advanced 3D facial recognition system enables passwordless, frictionless patient check-in and secure clinical access. No cards, no PINs — just your face.
              </p>

              {/* Precision and Latency Cards */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Precision Card */}
                <div className="bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-[#148F3A]">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="8" />
                          <line x1="12" y1="2" x2="12" y2="6" />
                          <line x1="12" y1="18" x2="12" y2="22" />
                          <line x1="2" y1="12" x2="6" y2="12" />
                          <line x1="18" y1="12" x2="22" y2="12" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">Precision</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#148F3A] bg-emerald-50 px-2 py-0.5 rounded-full">
                      &uarr; +0.2%
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">99.8%</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Biometric match accuracy</div>
                    </div>
                    <svg className="w-16 h-7 text-[#148F3A] shrink-0 mb-1" viewBox="0 0 70 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 18 C 15 18, 20 8, 35 12 C 48 15, 55 4, 68 2" />
                    </svg>
                  </div>
                </div>

                {/* Latency Card */}
                <div className="bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-[#148F3A]">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">Latency</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#148F3A] bg-emerald-50 px-2 py-0.5 rounded-full">
                      &darr; -12%
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">&lt;0.3s</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Instant check-in speed</div>
                    </div>
                    <svg className="w-16 h-7 text-[#148F3A] shrink-0 mb-1" viewBox="0 0 70 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 14 C 18 14, 25 22, 40 18 C 52 14, 58 4, 68 2" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Three Feature Rows */}
              <div className="mt-5 space-y-3">
                {[
                  {
                    icon: (
                      <svg className="w-4 h-4 text-[#148F3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ),
                    text: 'Encrypted biometric data \u2014 raw frames never stored',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-[#148F3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    ),
                    text: 'Real-time vitals correlation during scan',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-[#148F3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    ),
                    text: 'Secure authentication for both patients & doctors',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] rounded-2xl px-4 py-3 flex items-center justify-between transition-all hover:border-emerald-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-[#0F172A]">{item.text}</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-emerald-50/80 flex items-center justify-center text-[#148F3A] shrink-0 ml-3">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 2: TRUST & VALUE FOUNDATION ── */}
      <section id="about" className="py-20 bg-white border-t border-slate-100">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
          <div className="section-header mx-auto max-w-[760px] text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              Patient-First Foundation
            </span>
            <h2 className="mt-3 text-[clamp(2rem,3.6vw,2.8rem)] font-bold tracking-tight text-slate-900">
              Healthcare built around clarity, speed, and trust.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600">
              MediCure unites doctor scheduling, instant vitals tracking, and certified electronic records into one seamless clinical ecosystem.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="value-card p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">Intelligent Technology</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Automated triage and longitudinal vital signs recording that gives physicians actionable data instantly.
              </p>
            </div>

            <div className="value-card p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">Compassionate Care</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Designed to minimize paperwork and waiting times so doctors can spend more meaningful time with patients.
              </p>
            </div>

            <div className="value-card p-8 sm:col-span-2 lg:col-span-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">Secure Health Records</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Encrypted storage for lab results, clinical notes, and digital prescriptions complying with privacy standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: PLATFORM COCKPIT SHOWCASE ── */}
      <section id="platform" className="py-20 bg-[#F8FAFC] border-t border-slate-100">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
          <div className="section-header mx-auto max-w-[760px] text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800">
              Interactive Workspace
            </span>
            <h2 className="mt-3 text-[clamp(2rem,3.6vw,2.8rem)] font-bold tracking-tight text-slate-900">
              The MediCure clinical dashboard.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600">
              Everything doctors and patients need in one clean, unified interface.
            </p>
          </div>

          <div className="cockpit-mockup mt-14 overflow-hidden p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 font-mono text-xs text-slate-400">medicure.health/clinical-portal</span>
              </div>

              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('vitals')}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === 'vitals' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vitals Telemetry
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === 'records' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Medical Records
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('appointments')}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === 'appointments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Schedule
                </button>
              </div>
            </div>

            <div className="pt-6">
              {activeTab === 'vitals' && (
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="cockpit-card p-5">
                    <p className="text-xs font-medium text-slate-500">Resting Heart Rate</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">68 <span className="text-sm font-normal text-slate-400">bpm</span></p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Optimal resting cadence
                    </p>
                  </div>
                  <div className="cockpit-card p-5">
                    <p className="text-xs font-medium text-slate-500">Blood Pressure</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">118/78 <span className="text-sm font-normal text-slate-400">mmHg</span></p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Normotensive range
                    </p>
                  </div>
                  <div className="cockpit-card p-5">
                    <p className="text-xs font-medium text-slate-500">Oxygen Saturation (SpO2)</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">99%</p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Target saturation confirmed
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'records' && (
                <div className="space-y-3">
                  <div className="cockpit-card flex items-center justify-between p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-900">Comprehensive Metabolic Panel (CMP)</p>
                        <p className="text-xs text-slate-500">Validated by Pathology Lab &bull; ID #LAB-9042</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Verified
                    </span>
                  </div>
                  <div className="cockpit-card flex items-center justify-between p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <Pill className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-900">Digital Prescription: Amoxicillin 500mg</p>
                        <p className="text-xs text-slate-500">Routed to Hospital In-House Pharmacy</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Dispensed
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'appointments' && (
                <div className="space-y-3">
                  <div className="cockpit-card flex items-center justify-between p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-900">Cardiology Consultation &bull; Dr. Sarah Jenkins</p>
                        <p className="text-xs text-slate-500">Tomorrow at 10:30 AM &bull; Room 302</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Confirmed
                    </span>
                  </div>
                  <div className="cockpit-card flex items-center justify-between p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-900">Routine Vitals Check-in &bull; Telehealth Room</p>
                        <p className="text-xs text-slate-500">Friday at 2:00 PM &bull; Patient Portal</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Scheduled
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: FINAL CTA BANNER ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div id="final-cta-content" className="mx-auto max-w-[1360px] p-10 sm:p-14 text-center text-white">
          <h2 className="text-[clamp(2.2rem,4vw,3.2rem)] font-bold tracking-tight">
            Ready to experience better healthcare?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-emerald-50 max-w-2xl mx-auto">
            Join thousands of patients and healthcare professionals using MediCure for fast, reliable, and compassionate care.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-emerald-800 transition-all hover:bg-emerald-50 hover:shadow-lg"
            >
              Book an appointment
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 bg-white/10 px-8 text-sm font-semibold text-white transition-all hover:bg-white/20"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-14">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="footer-col md:col-span-2">
              <a href="#top" className="inline-flex items-center gap-2.5">
                <AivoraLogo className="h-7 w-7" />
                <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center">
                  MediCure
                  <span className="ml-1 h-2 w-2 rounded-full bg-[#EAB308]" />
                </span>
              </a>
              <p className="mt-3.5 max-w-sm text-sm text-slate-500 leading-relaxed">
                Expert care for your health and wellness. Providing accessible, advanced clinical management tools for patients and physicians.
              </p>
              <p className="mt-6 text-xs text-slate-400">
                &copy; 2026 MediCure Health Systems. All rights reserved.
              </p>
            </div>

            <div className="footer-col">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Navigation
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li><a href="#top" className="hover:text-emerald-600">Home</a></li>
                <li><a href="#platform" className="hover:text-emerald-600">Platform</a></li>
                <li><a href="#about" className="hover:text-emerald-600">About</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Portals
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li><Link to="/login" className="hover:text-emerald-600">Doctor Portal</Link></li>
                <li><Link to="/login" className="hover:text-emerald-600">Patient Portal</Link></li>
                <li><Link to="/register" className="hover:text-emerald-600">Book Appointment</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};
