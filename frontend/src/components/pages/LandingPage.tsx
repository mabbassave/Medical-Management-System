import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Cpu,
  FileText,
  Heart,
  Menu,
  MessageSquare,
  Phone,
  Pill,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import { FaFacebookF, FaInstagram, FaTwitter } from 'react-icons/fa';
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
  { label: 'Home', href: '#top' },
  { label: 'Platform', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'About', href: '#about' },
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
        .fromTo('.gsap-hero-actions > *', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.1 }, '-=0.35');

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
    <div ref={mainContainerRef} id="top" className="min-h-screen text-slate-900 antialiased selection:bg-emerald-100" style={{ background: '#F5FAF7' }}>

      {/* ── TOP NAVBAR ── */}
      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#F5FAF7]/92 backdrop-blur-md shadow-xs border-b border-emerald-900/5 py-3.5'
            : 'bg-transparent py-5 sm:py-6'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 sm:px-8 flex items-center justify-between">
          
          {/* Logo — 100% unchanged */}
          <a
            ref={logoRef}
            href="#top"
            aria-label="MediCure Home"
            className="group inline-flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128A50]"
          >
            <AivoraLogo className="h-8 w-8 transition-transform group-hover:scale-105" />
            <span className="text-xl font-bold tracking-tight text-[#101828] flex items-center">
              MediCure
              <span className="ml-1 h-2 w-2 rounded-full bg-[#EAB308]" />
            </span>
          </a>

          {/* Desktop Navigation Links — Centered */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center">
            <div ref={navLinksRef} className="flex items-center gap-1 sm:gap-2">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 transition-colors hover:text-[#128A50] hover:bg-[#DDF3E5]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128A50]"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Desktop Actions — Login & Sign Up */}
          <div ref={navActionsRef} className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-[#101828] transition-colors hover:text-[#128A50]"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#128A50] px-5 text-sm font-semibold text-white transition-all hover:bg-[#075B38] hover:shadow-[0_4px_16px_rgba(18,138,80,0.25)] active:scale-95"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── MOBILE MENU OVERLAY ── */}
      {isMenuOpen && (
        <div
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-[100] flex flex-col h-[100dvh] w-screen bg-[#F5FAF7] text-slate-900 px-6 py-6 md:hidden"
        >
          <div className="flex items-center justify-between pb-6 border-b border-slate-200">
            <a href="#top" onClick={closeMenu} className="inline-flex items-center gap-2.5">
              <AivoraLogo className="h-8 w-8" />
              <span className="text-xl font-bold tracking-tight text-[#101828] flex items-center">
                MediCure
                <span className="ml-1 h-2 w-2 rounded-full bg-[#EAB308]" />
              </span>
            </a>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMenu}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 py-10 flex flex-col justify-center space-y-5">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className="text-2xl font-semibold text-[#101828] transition-colors hover:text-[#128A50]"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-6 space-y-3 pb-4">
            <Link
              to="/login"
              onClick={closeMenu}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 text-sm font-semibold text-[#101828] hover:bg-slate-100"
            >
              Login
            </Link>
            <Link
              to="/register"
              onClick={closeMenu}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#128A50] text-sm font-semibold text-white hover:bg-[#075B38]"
            >
              Sign Up
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── HERO SECTION ── */}
      <main
        ref={heroSectionRef}
        className="relative overflow-hidden pt-28 sm:pt-32 pb-16 lg:pb-24 flex items-center min-h-[calc(100vh-80px)]"
      >
        <div className="max-w-[1280px] mx-auto px-6 sm:px-8 w-full">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">

            {/* Left Column — Text & CTAs */}
            <div className="lg:col-span-6 flex flex-col items-start z-10">
              
              {/* Small Category Label */}
              <div className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Certified Medical Technology
              </div>

              {/* Main Heading */}
              <h1 className="gsap-hero-title text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-[#101828] leading-[1.15] tracking-tight">
                Discover Advanced Healthcare For{' '}
                <span className="text-[#128A50] relative inline-block">
                  Your Wellness
                  <span
                    className="absolute left-0 -bottom-1 w-full h-[3.5px] bg-[#128A50] rounded-full"
                    aria-hidden="true"
                  />
                </span>
              </h1>

              {/* Description */}
              <p className="gsap-hero-desc mt-5 text-base sm:text-lg text-slate-500 leading-relaxed max-w-lg">
                Experience innovative medical technology, advanced diagnostics and reliable healthcare solutions designed around your needs.
              </p>

              {/* Two CTA Buttons */}
              <div className="gsap-hero-actions mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#platform"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#128A50] px-7 text-sm sm:text-base font-semibold text-white shadow-xs transition-all hover:bg-[#075B38] hover:shadow-[0_6px_20px_rgba(18,138,80,0.25)] active:scale-95"
                >
                  Explore Platform
                </a>
                <Link
                  to="/register"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200/90 bg-white px-7 text-sm sm:text-base font-semibold text-[#101828] shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                >
                  Get Started
                </Link>
              </div>

              {/* Social links below buttons */}
              <div className="mt-10 pt-4 flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-400">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#1877F2] group"
                >
                  <FaFacebookF className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Facebook</span>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E4405F] group"
                >
                  <FaInstagram className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Instagram</span>
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#1DA1F2] group"
                >
                  <FaTwitter className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Twitter</span>
                </a>
              </div>

            </div>

            {/* Right Column — Doctor Portrait & Floating Badges */}
            <div ref={heroVisualRef} className="lg:col-span-6 relative flex items-center justify-center gsap-hero-visual">
              
              <div className="relative w-full max-w-[460px] sm:max-w-[500px] flex items-center justify-center">

                {/* Soft Mint Gradient Orb behind doctor */}
                <div
                  className="absolute w-[360px] h-[360px] sm:w-[440px] sm:h-[440px] rounded-full bg-gradient-to-tr from-[#DDF3E5] via-[#C8EED5] to-[#E8F8EE] blur-2xl opacity-75 -z-10 pointer-events-none"
                  aria-hidden="true"
                />

                {/* Concentric Decorative Rings */}
                <div
                  className="absolute w-[420px] h-[420px] sm:w-[500px] sm:h-[500px] rounded-full border border-[#128A50]/15 pointer-events-none -z-10"
                  aria-hidden="true"
                />
                <div
                  className="absolute w-[500px] h-[500px] sm:w-[600px] sm:h-[600px] rounded-full border border-[#128A50]/10 pointer-events-none -z-10"
                  aria-hidden="true"
                />

                {/* 3D Floating Mint Sphere (top right) */}
                <div
                  className="absolute -top-3 right-4 sm:right-8 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#EAF8EE] via-[#CEEED8] to-[#9CD6B1] shadow-[inset_-4px_-4px_12px_rgba(7,91,56,0.15),0_12px_28px_rgba(18,138,80,0.12)] pointer-events-none z-0"
                  aria-hidden="true"
                />

                {/* Doctor Image Container — Smooth, consistent 28px rounded corners on all four corners */}
                <div
                  className="relative z-10 w-full overflow-hidden border border-white/60 shadow-[0_20px_50px_rgba(18,138,80,0.06)] bg-white/40"
                  style={{ borderRadius: '28px' }}
                >
                  <img
                    src="/doctor-hero.jpg"
                    alt="Doctor in medical coat with stethoscope"
                    className="w-full h-auto object-cover object-top max-h-[500px] sm:max-h-[540px] block"
                    style={{ borderRadius: '28px' }}
                    fetchPriority="high"
                  />
                </div>

                {/* Floating Bubble 1: Phone (top-left) */}
                <div
                  className="absolute -left-2 sm:-left-5 top-24 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white shadow-[0_10px_25px_rgba(16,24,40,0.08)] border border-slate-100 flex items-center justify-center transition-transform hover:scale-110"
                  title="Phone Consultation"
                >
                  <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-[#101828] fill-[#101828] -rotate-12" />
                </div>

                {/* Floating Bubble 2: Message (mid-left) */}
                <div
                  className="absolute -left-4 sm:-left-7 bottom-28 z-20 w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white shadow-[0_10px_25px_rgba(16,24,40,0.08)] border border-slate-100 flex items-center justify-center transition-transform hover:scale-110"
                  title="Direct Message"
                >
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-[#101828] fill-[#101828]" />
                </div>

                {/* Floating Bubble 3: Video (mid-right) */}
                <div
                  className="absolute -right-2 sm:-right-5 top-32 z-20 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white shadow-[0_10px_25px_rgba(16,24,40,0.08)] border border-slate-100 flex items-center justify-center transition-transform hover:scale-110"
                  title="Video Consultation"
                >
                  <Video className="w-6 h-6 sm:w-7 sm:h-7 text-[#101828] fill-[#101828]" />
                </div>

                {/* Floating Patient Review Card (bottom-left) */}
                <div className="absolute left-0 sm:-left-4 bottom-6 z-30 bg-white rounded-2xl shadow-[0_12px_32px_rgba(16,24,40,0.1)] border border-slate-100 py-2.5 px-3.5 flex items-center gap-3">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                    alt="Mh John avatar"
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#101828]">Mh John</div>
                    <div className="text-amber-400 text-xs tracking-wider">★★★★★</div>
                  </div>
                </div>

                {/* Floating Reviews Rating Card (bottom-right) */}
                <div className="absolute -right-1 sm:-right-5 bottom-8 z-30 bg-white rounded-2xl shadow-[0_12px_32px_rgba(16,24,40,0.1)] border border-slate-100 py-3 px-5 sm:px-6 text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-500 mb-1">
                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#101828] tracking-tight leading-tight">
                    1600+
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-slate-400 tracking-wide">
                    Reviews
                  </div>
                </div>

              </div>

            </div>

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
