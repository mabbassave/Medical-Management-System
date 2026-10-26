import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Activity,
  CalendarDays,
  CheckCircle2,
  Cpu,
  FileText,
  HeartPulse,
  Info,
  Layers,
  Menu,
  Pill,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AivoraLogo } from '../atoms/AivoraLogo';
import './LandingPage.css';

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

export const MedicalLogoMark: React.FC<{ className: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <path d="M39 4h22v9c0 13-7 22-16 31l-8 8-15-15 8-8c6-6 9-13 9-22V4Z" fill="#D9FF5B" />
    <path d="M96 39v22h-9c-13 0-22-7-31-16l-8-8 15-15 8 8c6 6 13 9 22 9h3Z" fill="#D9FF5B" />
    <path d="M61 96H39v-9c0-13 7-22 16-31l8-8 15 15-8 8c-6 6-9 13-9 22v3Z" fill="#D9FF5B" />
    <path d="M4 61V39h9c13 0 22 7 31 16l8 8-15 15-8-8c-6-6-13-9-22-9H4Z" fill="#D9FF5B" />
  </svg>
);

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

  // Restrained elevation on scroll
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
      // 1. Initial Navbar floating pill entrance
      const navTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (headerRef.current) {
        navTl.fromTo(headerRef.current, { y: -28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 });
      }
      if (logoRef.current) {
        navTl.fromTo(logoRef.current, { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4 }, '-=0.35');
      }
      if (navLinksRef.current) {
        navTl.fromTo(
          navLinksRef.current.children,
          { y: -10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.06 },
          '-=0.25'
        );
      }
      if (navActionsRef.current) {
        navTl.fromTo(
          navActionsRef.current.children,
          { y: -10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.08 },
          '-=0.2'
        );
      }

      // 2. Section 2: Hero Entrance & Parallax
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      heroTl
        .fromTo(
          '.gsap-hero-badge',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, delay: 0.1 }
        )
        .fromTo(
          '.gsap-hero-title',
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.65 },
          '-=0.35'
        )
        .fromTo(
          '.gsap-hero-desc',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55 },
          '-=0.4'
        )
        .fromTo(
          '.gsap-hero-actions > *',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, stagger: 0.1 },
          '-=0.35'
        )
        .fromTo(
          '.gsap-hero-pills > *',
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.08 },
          '-=0.3'
        );

      // Hero Visual Card Lift
      gsap.fromTo(
        '.gsap-hero-visual',
        { y: 35, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.85, ease: 'power2.out', delay: 0.2 }
      );

      // Subtle Hero Visual Parallax on scroll
      gsap.to('.hero-image-parallax', {
        y: -30,
        ease: 'none',
        scrollTrigger: {
          trigger: '#hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });

      // 3. Section 3: Trust & Value Foundation
      gsap.utils.toArray<HTMLElement>(
        '#about .section-header, #solutions .section-header, #how-it-works-section .section-header, #platform .section-header, #benefits-section .section-header, #final-cta-content, footer .footer-col',
        mainContainerRef.current
      ).forEach((element, index) => {
        setupRepeatableReveal(element, 26, 0.55, element.matches('footer .footer-col') ? (index % 4) * 0.08 : 0);
      });

      // 4. Section 4: Main Features / Platform Capabilities
      gsap.utils.toArray<HTMLElement>('.cockpit-mockup', mainContainerRef.current).forEach((element) => {
        setupRepeatableReveal(element, 38, 0.75, 0, 0.98);
      });
      gsap.to('.cockpit-ambient-glow', {
        scale: 1.25,
        opacity: 0.14,
        scrollTrigger: {
          trigger: '#platform',
          start: 'top 75%',
          end: 'bottom 25%',
          scrub: 1.2,
        },
      });

    }, mainContainerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const cardSelectors = [
        '.value-card',
        '.gsap-feature-card',
        '.gsap-step-item',
        '.benefit-card',
      ];
      cardSelectors.forEach((selector) => {
        gsap.utils.toArray<HTMLElement>(selector, mainContainerRef.current).forEach((card, index) => {
          setupRepeatableReveal(card, 26, 0.55, (index % 4) * 0.08);
        });
      });
    }, mainContainerRef);

    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.cockpit-card', mainContainerRef.current).forEach((card, index) => {
        setupRepeatableReveal(card, 20, 0.45, index * 0.08);
      });
    }, mainContainerRef);

    return () => ctx.revert();
  }, [activeTab]);

  // Mobile menu open/close transition, Escape listener & scroll lock
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
        gsap.fromTo(
          mobileMenuRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.24, ease: 'power2.out' }
        );
        gsap.fromTo(
          mobileMenuRef.current.querySelectorAll('.aivora-mobile-item'),
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.25, stagger: 0.05, delay: 0.05, ease: 'power2.out' }
        );
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // ── 3D Hero and card hover interactions ────────────────────────────────
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const cleanupFns: Array<() => void> = [];
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const heroSection = heroSectionRef.current;
    const heroCard = heroVisualRef.current;

    if (heroSection && heroCard) {
      const MAX_TILT = 8; // degrees
      const quickX = gsap.quickTo(heroCard, 'rotateY', { duration: 0.55, ease: 'power2.out' });
      const quickY = gsap.quickTo(heroCard, 'rotateX', { duration: 0.55, ease: 'power2.out' });

      const handleMouseMove = (e: MouseEvent) => {
        const rect = heroSection.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2); // -1 … 1
        const dy = (e.clientY - cy) / (rect.height / 2); // -1 … 1
        quickX(dx * MAX_TILT);
        quickY(-dy * MAX_TILT);
      };

      const handleMouseLeave = () => {
        gsap.to(heroCard, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'elastic.out(1,0.5)' });
      };

      if (!isTouchDevice) {
        heroSection.addEventListener('mousemove', handleMouseMove);
        heroSection.addEventListener('mouseleave', handleMouseLeave);
      }

      // Mobile: gentle looping oscillation instead of mouse tracking
      let mobileAnim: gsap.core.Tween | null = null;
      if (isTouchDevice) {
        mobileAnim = gsap.to(heroCard, {
          rotateY: 3,
          rotateX: -2,
          duration: 3,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }
      cleanupFns.push(() => {
        heroSection.removeEventListener('mousemove', handleMouseMove);
        heroSection.removeEventListener('mouseleave', handleMouseLeave);
        mobileAnim?.kill();
        gsap.killTweensOf(heroCard);
      });
    }

    if (!isTouchDevice) {
      const cardSelectors = ['.gsap-feature-card', '.value-card', '.gsap-step-item', '.benefit-card'];
      cardSelectors.forEach((selector) => {
        gsap.utils.toArray<HTMLElement>(selector, mainContainerRef.current).forEach((card) => {
          const quickRotateX = gsap.quickTo(card, 'rotateX', { duration: 0.35, ease: 'power2.out' });
          const quickRotateY = gsap.quickTo(card, 'rotateY', { duration: 0.35, ease: 'power2.out' });
          const icon = card.querySelector<HTMLElement>('.card-icon-inner');

          const handleMouseMove = (event: MouseEvent) => {
            const rect = card.getBoundingClientRect();
            const horizontal = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
            const vertical = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
            card.style.willChange = 'transform';
            quickRotateY(horizontal * 4);
            quickRotateX(-vertical * 4);
            if (icon) gsap.to(icon, { z: 6, duration: 0.3, ease: 'power2.out' });
          };

          const handleMouseLeave = () => {
            gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.5, ease: 'power2.out' });
            card.style.willChange = '';
            if (icon) gsap.to(icon, { z: 0, duration: 0.4, ease: 'power2.out' });
          };

          card.addEventListener('mousemove', handleMouseMove);
          card.addEventListener('mouseleave', handleMouseLeave);
          cleanupFns.push(() => {
            card.removeEventListener('mousemove', handleMouseMove);
            card.removeEventListener('mouseleave', handleMouseLeave);
            gsap.killTweensOf(card);
            if (icon) gsap.killTweensOf(icon);
          });
        });
      });

    }

    return () => cleanupFns.forEach((cleanup) => cleanup());
  }, []);

  return (
    <div ref={mainContainerRef} id="top" className="min-h-screen bg-white text-[#111111] antialiased selection:bg-[#396EF4] selection:text-[#111111]">

      {/* ── SECTION 1: NAVBAR — Floating pill at top → full-width on scroll ── */}
      <div
        className={`fixed inset-x-0 top-0 z-50 w-full pointer-events-none transition-[padding] duration-[250ms] ease-in-out ${isScrolled
            ? 'pt-0 px-0'
            : 'pt-4 px-4 sm:px-6 lg:px-8'
          }`}
      >
        <header
          ref={headerRef}
          className={`pointer-events-auto mx-auto w-full transition-[max-width,border-radius,height] duration-[250ms] ease-in-out ${isScrolled
              ? 'max-w-none rounded-[12px] lg:rounded-none border-b border-[#1F1F1F] bg-[#111111] shadow-none h-[72px]'
              : 'max-w-[1200px] rounded-[12px] border-0 bg-[#111111] shadow-none h-16'
            }`}
        >
          <div
            className={`flex h-full items-center justify-between transition-[padding] duration-[250ms] ease-in-out ${isScrolled
                ? 'mx-auto w-full px-6 sm:px-8'
                : 'px-5 sm:px-8'
              }`}
          >

            {/* Left: Medivanta logo and wordmark */}
            <a
              ref={logoRef}
              href="#top"
              aria-label="Medivanta Home"
              className="group inline-flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] transition-transform duration-200 group-hover:scale-105 group-hover:border-[#396EF4]/40">
                <AivoraLogo className="h-7 w-7" />
              </div>
              <span className="text-[21px] font-bold tracking-[-0.03em] text-white">Medivanta</span>
            </a>

            {/* Center: Navigation Links */}
            <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex lg:gap-10">
              <div ref={navLinksRef} className="flex items-center gap-8 lg:gap-10">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="group relative py-2 text-[14.5px] font-medium tracking-[-0.015em] text-white/75 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
                  >
                    {item.label}
                    <span className="absolute inset-x-0 -bottom-0.5 h-[1.5px] origin-left scale-x-0 bg-[#396EF4] transition-transform duration-200 group-hover:scale-x-100" />
                  </a>
                ))}
              </div>
            </nav>

            {/* Right: Actions */}
            <div ref={navActionsRef} className="hidden items-center gap-5 md:flex">
              <Link
                to="/login"
                className="rounded-md px-2 py-1.5 text-[14px] font-medium text-white/80 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-[#396EF4] px-5 text-[13.5px] font-semibold text-[#111111] transition-all duration-200 hover:bg-[#2858D8] hover:shadow-[0_4px_16px_rgba(57,110,244,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
              >
                Request a demo
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4] md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>
      </div>

      {/* ── FULL-SCREEN RESPONSIVE MOBILE NAVIGATION OVERLAY ── */}
      {isMenuOpen && (
        <div
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-[100] flex flex-col h-[100dvh] w-screen rounded-[12px] bg-[#111111] text-white overflow-y-auto px-6 py-6 md:hidden"
        >
          {/* Top Bar: Logo & Close Button */}
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <a
              href="#top"
              aria-label="Medivanta Home"
              onClick={closeMenu}
              className="inline-flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04]">
                <AivoraLogo className="h-7 w-7" />
              </div>
              <span className="text-xl font-bold tracking-[-0.03em] text-white">Medivanta</span>
            </a>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMenu}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Center: Vertical Navigation Links */}
          <div className="flex-1 py-8 flex flex-col justify-center space-y-3">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className="aivora-mobile-item flex items-center justify-between rounded-xl px-4 py-3.5 text-xl font-medium text-white/90 transition-colors hover:bg-white/[0.06] hover:text-[#396EF4]"
              >
                <span>{item.label}</span>
                <ArrowRight className="h-4 w-4 text-white/30" />
              </a>
            ))}
          </div>

          {/* Bottom: Action Buttons */}
          <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-3">
            <Link
              to="/login"
              onClick={closeMenu}
              className="aivora-mobile-item inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              Log in
            </Link>
            <Link
              to="/register"
              onClick={closeMenu}
              className="aivora-mobile-item inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#396EF4] text-sm font-semibold text-[#111111] transition-colors hover:bg-[#2858D8]"
            >
              Request a demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── SECTION 2: HERO (White Background) ── */}
      <section ref={heroSectionRef} id="hero-section" className="relative overflow-hidden bg-white pb-20 pt-24 text-[#111111] sm:pb-24 sm:pt-28 lg:pb-32 lg:pt-28">
        {/* Subtle Ambient Glow */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
          <div className="h-[420px] w-[700px] rounded-full bg-[#396EF4]/20 blur-[130px]" />
        </div>

        <div className="relative mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">

            {/* Left Column: Headline & CTAs */}
            <div className="gsap-hero-content max-w-[680px]">
              <div className="flex flex-col items-start">
                <p className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-[#6B6B6B]">AI-POWERED MEDICAL MANAGEMENT</p>
                <h1 className="gsap-hero-title max-w-[680px] text-[clamp(38px,6vw,60px)] font-bold leading-[1.06] tracking-[-0.035em] text-[#172554]">
                  Smarter Healthcare for a Healthier Tomorrow
                </h1>
              </div>

              <p className="gsap-hero-desc mt-5 text-base leading-relaxed text-[#6B6B6B] sm:text-[18px] sm:leading-[1.65]">
                Medivanta combines AI technology with modern healthcare to deliver faster, smarter, and more personalised care for every patient.
              </p>

              <div className="gsap-hero-actions mt-8 flex flex-wrap items-center gap-4 sm:mt-10">
                <Link
                  to="/register"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#396EF4] px-7 text-sm font-semibold text-[#111111] transition-all duration-200 hover:bg-[#2858D8] hover:shadow-[0_4px_20px_rgba(57,110,244,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[#E5EAF2] bg-white px-7 text-sm font-semibold text-[#111111] transition-all duration-200 hover:border-[#E5EAF2] hover:bg-[#F5F7FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                >
                  Talk to Our Team
                </Link>
              </div>

              {/* Verified Product Core Capabilities */}
              <div className="gsap-hero-pills mt-12 grid grid-cols-3 gap-4 border-t border-[#E5EAF2] pt-8 text-xs text-[#6B6B6B] sm:text-[13px]">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-[#396EF4]" />
                  <span>Vitals Tracking</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 text-[#396EF4]" />
                  <span>Appointments</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-[#396EF4]" />
                  <span>Electronic Records</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Mockup — 3D tilt wrapper */}
            <div className="gsap-hero-visual relative mx-auto w-full max-w-[560px] lg:ml-auto"
              style={{ perspective: '900px', perspectiveOrigin: 'center center' }}
            >
              {/* heroVisualRef sits on this inner div so rotateX/Y apply in 3D space */}
              <div
                ref={heroVisualRef}
                style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
              >
                <div className="relative overflow-hidden rounded-[24px] border border-[#E5EAF2] bg-[#F5F7FB] p-2 shadow-[0_24px_50px_-12px_rgba(15,23,42,0.18)] sm:rounded-[32px]">
                  <div className="relative aspect-[1.12/1] overflow-hidden rounded-[20px] sm:rounded-[26px]">
                    <img
                      src="/doctor-hero.jpg"
                      alt="Clinical care professional utilizing the Medivanta digital health interface"
                      className="hero-image-parallax h-full w-full object-cover object-[center_35%]"
                      fetchPriority="high"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/80 via-transparent to-transparent" />

                    {/* Floating Telemetry Badge — counter-translates for layered parallax */}
                    <div
                      className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-3.5 py-1.5 text-[11px] font-semibold text-[#111111] shadow-sm backdrop-blur-md"
                      style={{ transform: 'translateZ(20px)' }}
                    >
                      <span className="h-2 w-2 rounded-full bg-[#396EF4]" />
                      Real-time clinical stream
                    </div>

                    {/* Layered Card: Bottom Preview — slightly raised in Z */}
                    <div
                      className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-[#111111]/95 p-4 shadow-xl backdrop-blur-md sm:p-5"
                      style={{ transform: 'translateZ(12px)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#396EF4]/15 text-[#396EF4]">
                            <HeartPulse className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Active Patient Triage</p>
                            <p className="text-xs text-white/60">Automated vitals monitoring</p>
                          </div>
                        </div>
                        <span className="rounded-md border border-[#396EF4]/30 bg-[#396EF4]/10 px-2.5 py-1 text-[11px] font-semibold text-[#396EF4]">
                          Stable
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                        <div>
                          <p className="text-[10px] text-white/50">Heart Rate</p>
                          <p className="text-xs font-semibold text-white">72 bpm</p>
                        </div>
                        <div className="border-l border-white/10">
                          <p className="text-[10px] text-white/50">Blood Pressure</p>
                          <p className="text-xs font-semibold text-white">120/80</p>
                        </div>
                        <div className="border-l border-white/10">
                          <p className="text-[10px] text-white/50">SpO2</p>
                          <p className="text-xs font-semibold text-white">99%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 3: AI FACE SCAN ── */}
      <section
        id="face-scan"
        className="face-scan-section border-t border-white/[0.08] bg-[#111111] py-16 text-white sm:py-20 lg:py-24"
      >
        <div className="mx-auto grid max-w-[1360px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:px-8">
          <div className="face-scan-visual-shell mx-auto w-full max-w-[600px]">
            <div className="face-scan-visual">
              <div className="face-scan-image-frame">
                <img
                  className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
                  src="/doctor-face-scan.jpg"
                  alt="Doctor portrait for facial mapping"
                />
                <div className="face-scan-grid" aria-hidden="true" />
                <div className="face-scan-corners" aria-hidden="true" />
                <div className="face-scan-beam" aria-hidden="true" />
                <span className="face-scan-point face-scan-point-one" aria-hidden="true" />
                <span className="face-scan-point face-scan-point-two" aria-hidden="true" />
                <span className="face-scan-point face-scan-point-three" aria-hidden="true" />
                <div className="face-scan-status" aria-hidden="true">
                  <span className="face-scan-status-dot" />
                  FACIAL MAPPING
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[560px] lg:mx-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#396EF4]/25 bg-[#396EF4]/[0.08] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#396EF4]">
              <Sparkles className="h-3.5 w-3.5" />
              AI Wellness Experience
            </span>
            <h2 className="mt-5 text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.12] tracking-[-0.04em] text-white">
              Explore AI-Powered Face Scanning
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
              A guided facial analysis experience may estimate selected wellness indicators from visual cues. It is for general information only and is not a diagnosis or a substitute for professional medical advice.
            </p>
            <div className="mt-7 flex items-center gap-3 text-sm text-white/55">
              <Info className="h-4 w-4 shrink-0 text-[#396EF4]" />
              <span>Informational estimates only — no diagnosis or guaranteed health results.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: TRUST & VALUE INTRODUCTION ── */}
      <section id="about" className="border-t border-[#E5EAF2] bg-white py-20 text-[#111111] sm:py-24 lg:py-28">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">

          <div className="section-header mx-auto max-w-[760px] text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#396EF4]">
              Value Foundation
            </p>
            <h2 className="mt-3 text-[clamp(1.9rem,3.8vw,2.9rem)] font-medium leading-[1.18] tracking-[-0.035em] text-[#111111]">
              Technology designed around better health experiences.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#6B6B6B] sm:text-lg">
              Medivanta delivers a structured clinical ecosystem where healthcare providers and patients experience unified care coordination, accurate records, and clear visibility.
            </p>
          </div>

          <div id="value-cards-container" className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">

            {/* Value Point 1 */}
            <div className="value-card rounded-2xl border border-[#E5EAF2] bg-[#F5F7FB] p-8 transition-shadow duration-200 hover:shadow-lg" style={{ transformStyle: 'preserve-3d' }}>
              <div className="card-icon-inner flex h-12 w-12 items-center justify-center rounded-xl bg-[#111111] text-[#396EF4]">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Intelligent technology
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Smart workflow routing that unifies appointment calendars, electronic medical records, and digital prescription dispensing in one reliable infrastructure.
              </p>
            </div>

            {/* Value Point 2 */}
            <div className="value-card rounded-2xl border border-[#E5EAF2] bg-[#F5F7FB] p-8 transition-shadow duration-200 hover:shadow-lg" style={{ transformStyle: 'preserve-3d' }}>
              <div className="card-icon-inner flex h-12 w-12 items-center justify-center rounded-xl bg-[#111111] text-[#396EF4]">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Human-centered experiences
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Crafted for intuitive interaction between practitioners, nurses, and patients, reducing administrative fatigue and putting focus back on clinical care.
              </p>
            </div>

            {/* Value Point 3 */}
            <div className="value-card rounded-2xl border border-[#E5EAF2] bg-[#F5F7FB] p-8 transition-shadow duration-200 hover:shadow-lg sm:col-span-2 lg:col-span-1" style={{ transformStyle: 'preserve-3d' }}>
              <div className="card-icon-inner flex h-12 w-12 items-center justify-center rounded-xl bg-[#111111] text-[#396EF4]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Clear, accessible insights
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Actionable summaries of patient vitals histories, lab analyses, and treatment plans without information silos or convoluted data structures.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 4: MAIN FEATURES ── */}
      <section id="solutions" className="border-t border-white/[0.08] bg-[#111111] py-20 text-white sm:py-24 lg:py-28">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">

          <div className="section-header mx-auto max-w-[720px] text-center">
            <span className="inline-block rounded-full border border-[#396EF4]/30 bg-[#396EF4]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#396EF4]">
              Platform Capabilities
            </span>
            <h2 className="mt-4 text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.16] tracking-[-0.04em] text-white">
              Engineered for seamless clinical operations.
            </h2>
            <p className="mt-4 text-base text-white/70 sm:text-lg">
              Explore the four core pillars powering healthcare facilities and patient engagement on Medivanta.
            </p>
          </div>

          <div id="features-container" className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            {/* Feature 1 */}
            <div className="gsap-feature-card group rounded-2xl border border-white/10 bg-[#111111] p-7 transition-colors duration-200 hover:border-[#396EF4]/50 hover:bg-[#111111] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]" style={{ transformStyle: 'preserve-3d' }}>
              <div className="card-icon-inner flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-[#396EF4] transition-transform duration-200 group-hover:scale-110">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-white">
                AI-Powered Experiences
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/65">
                Automated triage recording and longitudinal health marker tracking that flags abnormal vitals indicators proactively for clinical review.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="gsap-feature-card group rounded-2xl border border-white/10 bg-[#111111] p-7 transition-colors duration-200 hover:border-[#396EF4]/50 hover:bg-[#111111] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]" style={{ transformStyle: 'preserve-3d' }}>
              <div className="card-icon-inner flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-[#396EF4] transition-transform duration-200 group-hover:scale-110">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-white">
                Clear & Actionable Information
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/65">
                Centralized Electronic Medical Records (EMR) and diagnostic lab reporting organized chronologically with zero visual clutter.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="gsap-feature-card group rounded-2xl border border-white/10 bg-[#111111] p-7 transition-colors duration-200 hover:border-[#396EF4]/50 hover:bg-[#111111] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]" style={{ transformStyle: 'preserve-3d' }}>
              <div className="card-icon-inner flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-[#396EF4] transition-transform duration-200 group-hover:scale-110">
                <CalendarDays className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-white">
                Seamless Digital Interactions
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/65">
                Effortless online appointment booking and real-time schedule alignment between specialized doctors and active patients.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="gsap-feature-card group rounded-2xl border border-white/10 bg-[#111111] p-7 transition-colors duration-200 hover:border-[#396EF4]/50 hover:bg-[#111111] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]" style={{ transformStyle: 'preserve-3d' }}>
              <div className="card-icon-inner flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-[#396EF4] transition-transform duration-200 group-hover:scale-110">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-white">
                Scalable Technology
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/65">
                Multi-tenant role-based security protecting sensitive patient records, billing transactions, and e-prescription authorization.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 5: HOW IT WORKS ── */}
      <section id="how-it-works-section" className="border-t border-[#E5EAF2] bg-[#F5F7FB] py-20 text-[#111111] sm:py-24 lg:py-28">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">

          <div className="section-header mx-auto max-w-[700px] text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#396EF4]">
              Simple Three-Step Progression
            </span>
            <h2 className="mt-3 text-[clamp(1.9rem,3.8vw,2.9rem)] font-medium leading-[1.18] tracking-[-0.035em] text-[#111111]">
              How Medivanta transforms the care journey.
            </h2>
            <p className="mt-4 text-base text-[#6B6B6B] sm:text-lg">
              A clear, predictable progression from initial intake to ongoing care.
            </p>
          </div>

          <div id="steps-container" className="mt-16 grid gap-8 md:grid-cols-3">

            {/* Step 1 */}
            <div className="gsap-step-item relative rounded-2xl border border-[#E5EAF2] bg-white p-8 shadow-sm">
              <span className="text-3xl font-extrabold tracking-tight text-[#396EF4] drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
                01
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Connect
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Onboard doctors, clinical teams, and patients into a secure workspace. Synchronize department schedules and patient profiles instantly.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#111111]">
                <CheckCircle2 className="h-4 w-4 text-[#396EF4]" />
                Profile & Schedule Sync
              </div>
            </div>

            {/* Step 2 */}
            <div className="gsap-step-item relative rounded-2xl border border-[#E5EAF2] bg-white p-8 shadow-sm">
              <span className="text-3xl font-extrabold tracking-tight text-[#396EF4] drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
                02
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Understand
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Capture and visualize vital signs, historical records, and lab findings in real-time dashboards that highlight critical trends.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#111111]">
                <CheckCircle2 className="h-4 w-4 text-[#396EF4]" />
                Unified Health History
              </div>
            </div>

            {/* Step 3 */}
            <div className="gsap-step-item relative rounded-2xl border border-[#E5EAF2] bg-white p-8 shadow-sm">
              <span className="text-3xl font-extrabold tracking-tight text-[#396EF4] drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
                03
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Take the Next Step
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Issue validated digital prescriptions, schedule follow-ups, and provide patients with transparent access through their dedicated portal.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#111111]">
                <CheckCircle2 className="h-4 w-4 text-[#396EF4]" />
                Actionable Follow-up Care
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 6: FEATURED PLATFORM / PRODUCT SHOWCASE ── */}
      <section id="platform" className="relative overflow-hidden border-t border-white/[0.08] bg-[#111111] py-20 text-white sm:py-24 lg:py-28">
        {/* Subtle Ambient Parallax Glow */}
        <div aria-hidden="true" className="cockpit-ambient-glow pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[800px] rounded-full bg-[#396EF4]/[0.08] blur-[140px]" />

        <div className="relative mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">

          <div className="section-header mx-auto max-w-[760px] text-center">
            <span className="inline-block rounded-full border border-[#396EF4]/30 bg-[#396EF4]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#396EF4]">
              Interactive Showcase
            </span>
            <h2 className="mt-4 text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.16] tracking-[-0.04em] text-white">
              The Medivanta clinical cockpit.
            </h2>
            <p className="mt-4 text-base text-white/70 sm:text-lg">
              Experience the unified dashboard bringing vitals telemetry, medical histories, and appointments into one high-efficiency view.
            </p>
          </div>

          {/* Interactive Mockup Container */}
          <div className="cockpit-mockup mt-16 overflow-hidden rounded-[24px] border border-white/15 bg-[#111111] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8)]">

            {/* Top Mockup Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#111111] px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 rounded-full bg-[#FF5F56]" />
                <span className="flex h-3 w-3 rounded-full bg-[#FFBD2E]" />
                <span className="flex h-3 w-3 rounded-full bg-[#27C93F]" />
                <span className="ml-3 text-xs font-medium text-white/50">aivora.app/workspace/clinical</span>
              </div>

              {/* Tab Toggles */}
              <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('vitals')}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${activeTab === 'vitals'
                      ? 'bg-[#396EF4] text-[#111111]'
                      : 'text-white/70 hover:text-white'
                    }`}
                >
                  Vitals Telemetry
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${activeTab === 'records'
                      ? 'bg-[#396EF4] text-[#111111]'
                      : 'text-white/70 hover:text-white'
                    }`}
                >
                  Medical Records
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('appointments')}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${activeTab === 'appointments'
                      ? 'bg-[#396EF4] text-[#111111]'
                      : 'text-white/70 hover:text-white'
                    }`}
                >
                  Schedule
                </button>
              </div>
            </div>

            {/* Mockup Body Content */}
            <div className="p-6 sm:p-8">
              {activeTab === 'vitals' && (
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="cockpit-card rounded-xl border border-white/10 bg-[#111111] p-5">
                    <p className="text-xs font-medium text-white/50">Resting Heart Rate</p>
                    <p className="mt-2 text-3xl font-semibold text-white">68 <span className="text-sm font-normal text-white/50">bpm</span></p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-[#396EF4]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Optimal resting cadence
                    </p>
                  </div>
                  <div className="cockpit-card rounded-xl border border-white/10 bg-[#111111] p-5">
                    <p className="text-xs font-medium text-white/50">Blood Pressure</p>
                    <p className="mt-2 text-3xl font-semibold text-white">118/78 <span className="text-sm font-normal text-white/50">mmHg</span></p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-[#396EF4]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Normotensive range
                    </p>
                  </div>
                  <div className="cockpit-card rounded-xl border border-white/10 bg-[#111111] p-5">
                    <p className="text-xs font-medium text-white/50">Oxygen Saturation</p>
                    <p className="mt-2 text-3xl font-semibold text-white">99% <span className="text-sm font-normal text-white/50">SpO2</span></p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-[#396EF4]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Target saturation confirmed
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'records' && (
                <div className="space-y-3">
                  <div className="cockpit-card flex items-center justify-between rounded-xl border border-white/10 bg-[#111111] p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-[#396EF4]" />
                      <div>
                        <p className="font-semibold text-white">Comprehensive Metabolic Panel (CMP)</p>
                        <p className="text-xs text-white/50">Validated by Pathology Lab &bull; ID #LAB-9042</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-[#396EF4]/10 px-2.5 py-1 text-xs font-semibold text-[#396EF4]">
                      Verified
                    </span>
                  </div>
                  <div className="cockpit-card flex items-center justify-between rounded-xl border border-white/10 bg-[#111111] p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <Pill className="h-5 w-5 text-[#396EF4]" />
                      <div>
                        <p className="font-semibold text-white">Digital Prescription: Amoxicillin 500mg</p>
                        <p className="text-xs text-white/50">Routed to Hospital In-House Pharmacy</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-[#396EF4]/10 px-2.5 py-1 text-xs font-semibold text-[#396EF4]">
                      Dispensed
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'appointments' && (
                <div className="space-y-3">
                  <div className="cockpit-card flex items-center justify-between rounded-xl border border-white/10 bg-[#111111] p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-[#396EF4]" />
                      <div>
                        <p className="font-semibold text-white">Cardiology Consultation &bull; Dr. Sarah Jenkins</p>
                        <p className="text-xs text-white/50">Tomorrow at 10:30 AM &bull; Room 302</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-[#396EF4]/15 px-2.5 py-1 text-xs font-semibold text-[#396EF4]">
                      Confirmed
                    </span>
                  </div>
                  <div className="cockpit-card flex items-center justify-between rounded-xl border border-white/10 bg-[#111111] p-4 text-sm">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-[#396EF4]" />
                      <div>
                        <p className="font-semibold text-white">Routine Vitals Check-in &bull; Telehealth Room</p>
                        <p className="text-xs text-white/50">Friday at 2:00 PM &bull; Patient Portal</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
                      Scheduled
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-between border-t border-white/10 pt-5 text-xs text-white/60">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#396EF4]" />
                  Protected Health Information (PHI) &bull; End-to-End Encryption
                </span>
                <Link to="/register" className="font-semibold text-[#396EF4] hover:underline">
                  Explore Full Workspace &rarr;
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 7: BENEFITS ── */}
      <section id="benefits-section" className="border-t border-[#E5EAF2] bg-white py-20 text-[#111111] sm:py-24 lg:py-28">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">

          <div className="section-header mx-auto max-w-[720px] text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#396EF4]">
              Measurable Advantages
            </span>
            <h2 className="mt-3 text-[clamp(1.9rem,3.8vw,2.9rem)] font-medium leading-[1.18] tracking-[-0.035em] text-[#111111]">
              Why clinical teams choose Medivanta.
            </h2>
          </div>

          <div id="benefits-container" className="mt-16 grid gap-8 md:grid-cols-2">

            {/* Benefit 1 */}
            <div className="benefit-card rounded-2xl border border-[#E5EAF2] bg-[#F5F7FB] p-8 transition-shadow duration-200 hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111111] text-[#396EF4]">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Simplicity
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                A single unified workspace replaces fragmented portals for appointments, patient histories, and pharmacy stock, eliminating cognitive burden for staff.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="benefit-card rounded-2xl border border-[#E5EAF2] bg-[#F5F7FB] p-8 transition-shadow duration-200 hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111111] text-[#396EF4]">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Clarity
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Clinical records presented in modern, legible typography with structured data views designed specifically for fast-paced healthcare environments.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="benefit-card rounded-2xl border border-[#E5EAF2] bg-[#F5F7FB] p-8 transition-shadow duration-200 hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111111] text-[#396EF4]">
                <Workflow className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                Thoughtful Technology
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Real-world clinical workflows built with precision: role-aware dashboards for physicians, triage personnel, administrative staff, and patients.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="benefit-card rounded-2xl border border-[#E5EAF2] bg-[#F5F7FB] p-8 transition-shadow duration-200 hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111111] text-[#396EF4]">
                <HeartPulse className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#111111]">
                A More Connected Digital Experience
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Continuous connection between in-clinic medical consultations and ongoing patient monitoring through secure portal access.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 8: FINAL CTA ── */}
      <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#111111] py-20 text-white sm:py-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[360px] w-[600px] rounded-full bg-[#396EF4]/[0.08] blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-[1360px] px-4 text-center sm:px-6 lg:px-8">
          <div id="final-cta-content" className="mx-auto max-w-[740px]">
            <h2 className="text-[clamp(2.2rem,4.8vw,3.6rem)] font-medium leading-[1.12] tracking-[-0.04em] text-white">
              Let's shape a smarter <br />
              <span className="text-[#396EF4]">health experience.</span>
            </h2>
            <p className="mt-6 text-base text-white/70 sm:text-lg">
              Explore how Medivanta can support your next step in healthcare technology.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#396EF4] px-8 text-sm font-semibold text-[#111111] transition-all duration-200 hover:bg-[#2858D8] hover:shadow-[0_4px_20px_rgba(57,110,244,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
              >
                Talk to Our Team
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] px-8 text-sm font-semibold text-white transition-all duration-200 hover:border-white/40 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#396EF4]"
              >
                Log In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 9: FOOTER ── */}
      <footer className="border-t border-white/10 bg-[#111111] py-14 text-white sm:py-16">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">

          <div className="grid gap-10 md:grid-cols-4 lg:gap-12">

            {/* Brand column */}
            <div className="footer-col md:col-span-2">
              <a href="#top" className="inline-flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <AivoraLogo className="h-6 w-6" />
                </div>
                <span className="text-xl font-bold tracking-[-0.03em] text-white">Medivanta</span>
              </a>
              <p className="mt-4 max-w-[380px] text-sm leading-relaxed text-white/60">
                Intelligent digital healthcare platform streamlining clinical workflows, patient appointments, electronic medical records, and vitals monitoring.
              </p>
              <p className="mt-6 text-xs text-white/40">
                &copy; 2026 Medivanta Health Technologies. All rights reserved.
              </p>
            </div>

            {/* Navigation links */}
            <div className="footer-col">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                Navigation
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-white/65">
                <li><a href="#top" className="transition-colors hover:text-[#396EF4]">Home</a></li>
                <li><a href="#platform" className="transition-colors hover:text-[#396EF4]">Platform</a></li>
                <li><a href="#solutions" className="transition-colors hover:text-[#396EF4]">Solutions</a></li>
                <li><a href="#about" className="transition-colors hover:text-[#396EF4]">About</a></li>
              </ul>
            </div>

            {/* Verified Clinical Modules */}
            <div className="footer-col">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                Clinical Portals
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-white/65">
                <li><Link to="/login" className="transition-colors hover:text-[#396EF4]">Doctor Workspace</Link></li>
                <li><Link to="/login" className="transition-colors hover:text-[#396EF4]">Patient Portal</Link></li>
                <li><Link to="/register" className="transition-colors hover:text-[#396EF4]">Request Access</Link></li>
              </ul>
            </div>

          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-6 text-xs text-white/50">
            <p>Role-based access control &bull; HIPAA & GDPR compliance architectural standards</p>
            <p>Designed with care for healthcare professionals.</p>
          </div>
          <p className="mt-4 text-[12px] text-[#8A8A8A]">3D model by hedy magroun · CC BY 3.0</p>

        </div>
      </footer>

    </div>
  );
};
