import React, { useState, useEffect, useRef } from 'react';
import {
  WifiOff,
  RefreshCw,
  HeartHandshake,
  ArrowRight,
  Lock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Menu,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { SiteFooter, WebsitePage } from './SiteFooter.tsx';
import heroSlide1 from '../assets/images/hero_slide_community_care_1790424641353.jpg';
import heroSlide2 from '../assets/images/hero_slide_followup_home_1790424654759.jpg';
import heroSlide3 from '../assets/images/hero_slide_clinic_team_1790424668069.jpg';

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  error: string | null;
  loading: boolean;
  isAuthenticated?: boolean;
  onReturnToWorkspace?: () => void;
  initialPage?: WebsitePage;
}

interface HeroSlide {
  id: number;
  kicker: string;
  headline: string;
  typewriterPhrases: string[];
  description: string;
  image: string;
  imageAlt: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  secondaryTargetPage: WebsitePage;
  proofMetric: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 0,
    kicker: '01 · Care Without Internet Barriers',
    headline: 'Reliable patient care for every community clinic.',
    typewriterPhrases: [
      'Record patient visits even without internet.',
      'Save vital signs safely on your phone or tablet.',
      'Sync everything in one tap when connection returns.',
    ],
    description:
      'NEXORA Health helps nurses and community health workers register families, check vital signs, and record daily clinic visits smoothly—whether mobile coverage is strong or completely offline.',
    image: heroSlide1,
    imageAlt: 'Community health nurse consulting a mother with a digital tablet in a bright clinic',
    primaryCtaLabel: 'Sign In to Clinic Portal',
    secondaryCtaLabel: 'Explore Our Services',
    secondaryTargetPage: 'services',
    proofMetric: 'Works seamlessly online and offline across community clinics',
  },
  {
    id: 1,
    kicker: '02 · Every Mother & Child Remembered',
    headline: 'Never miss an important home visit or follow-up.',
    typewriterPhrases: [
      'Automatic reminders for upcoming checkups.',
      'Clear daily lists of families who need a visit.',
      'Instant age calculation and gentle safety checks.',
    ],
    description:
      'From maternal checkups to child fever follow-ups, your daily schedule stays organized automatically so you can focus on caring for people rather than searching through paper folders.',
    image: heroSlide2,
    imageAlt: 'Community health worker walking through a sunlit neighborhood for a home follow-up visit',
    primaryCtaLabel: 'Access Live Workspace',
    secondaryCtaLabel: 'Read Our Story',
    secondaryTargetPage: 'about',
    proofMetric: 'AI-assisted visit notes and automatic follow-up scheduling',
  },
  {
    id: 2,
    kicker: '03 · Clear Insights for Clinic Leaders',
    headline: 'Turn daily health visits into better community decisions.',
    typewriterPhrases: [
      'Spot neighborhood health trends early.',
      'Catch duplicate or missing notes automatically.',
      'Share clean referral records with partner hospitals.',
    ],
    description:
      'Clinic teams get a calm, easy-to-read overview of community health trends, AI care guidance, and hospital referrals—without complicated spreadsheets or technical jargon.',
    image: heroSlide3,
    imageAlt: 'Clinic doctors and coordinators reviewing community health progress together',
    primaryCtaLabel: 'Staff Sign In',
    secondaryCtaLabel: 'Meet Our Team',
    secondaryTargetPage: 'team',
    proofMetric: 'Zero lost patient records during rural network outages',
  },
];

const SERVICES_LIST = [
  {
    number: '01',
    category: 'field',
    title: 'Offline Patient & Visit Recording',
    outcome: 'Works 100% without mobile data or Wi-Fi',
    description:
      'Register new patients, automatically calculate age from date of birth, and record blood pressure, temperature, pulse, and visit notes even in remote villages with zero signal.',
  },
  {
    number: '02',
    category: 'field',
    title: 'One-Tap Safe Record Sync',
    outcome: 'Automatic backup when connection returns',
    description:
      'All visits recorded offline wait neatly in your Pending Action list. As soon as you return to clinic Wi-Fi or mobile coverage, one tap sends everything safely to the central clinic.',
  },
  {
    number: '03',
    category: 'quality',
    title: 'AI Care Assistant & Safety Checks',
    outcome: 'Smart suggestions & instant range verification',
    description:
      'Get real-time AI assistance to draft clear clinical observations, recommend care actions, and check that vital signs are within safe physiological ranges before saving.',
  },
  {
    number: '04',
    category: 'field',
    title: 'Maternal, Child & Follow-Up Reminders',
    outcome: 'Keeps mothers and children connected to care',
    description:
      'Schedule next checkup dates during any visit. Overdue and due-today home visits appear right at the top of the dashboard so no patient falls through the cracks.',
  },
  {
    number: '05',
    category: 'leadership',
    title: 'Plain-Language Clinic & AI Insights',
    outcome: 'Clear live summaries for clinic teams',
    description:
      'See which neighborhoods have rising visit volumes, ask the AI Health Assistant questions about your live clinic records, and track follow-up completion in everyday language.',
  },
  {
    number: '06',
    category: 'leadership',
    title: 'Hospital Referral & Standard Record Sharing',
    outcome: 'Ready to share with specialist hospitals',
    description:
      'When a patient needs specialist hospital care, NEXORA prepares a clean, standardized health summary that receiving doctors can review immediately.',
  },
];

const TEAM_MEMBERS = [
  {
    name: 'Dr. Tunde Okonkwo',
    role: 'Chief Medical Officer & Clinical Lead',
    department: 'clinical',
    location: 'Kano & Kaduna Catchment Zone',
    experience: '14 years in Primary Health Care & Maternal Medicine',
    bio: 'Leads clinical safety standards and district hospital referral partnerships across Northern Nigeria primary health centers.',
    initials: 'TO',
  },
  {
    name: 'Amina Bello',
    role: 'Lead Community Health Coordinator',
    department: 'clinical',
    location: 'Ungogo Ward A',
    experience: '9 years in Frontline Maternal & Child Outreach',
    bio: 'Trains frontline health workers and shapes every form and checklist in NEXORA so it feels natural during busy clinic mornings.',
    initials: 'AB',
  },
  {
    name: 'Engr. Ibrahim Danjuma',
    role: 'Head of Offline Reliability & Field Systems',
    department: 'product',
    location: 'Abuja & Kano',
    experience: '11 years in Low-Connectivity Mobile Engineering',
    bio: 'Designs NEXORA’s offline storage and one-tap sync so clinics never lose a single patient record when mobile networks drop.',
    initials: 'ID',
  },
  {
    name: 'Dr. Chidinma Okafor',
    role: 'Director of Health Quality & Patient Privacy',
    department: 'product',
    location: 'Lagos & Abuja',
    experience: '10 years in Public Health Epidemiology & Data Ethics',
    bio: 'Ensures every patient record follows Nigeria Data Protection Act (NDPA) privacy principles and clear clinical quality standards.',
    initials: 'CO',
  },
  {
    name: 'Musa Abdullahi',
    role: 'Field Support & Clinic Onboarding Specialist',
    department: 'partnerships',
    location: 'Sabon Gari Rural & Zaria',
    experience: '7 years in Rural Clinic Operations',
    bio: 'Supports local clinics with tablet setup, solar charging kits, and hands-on training for new health workers.',
    initials: 'MA',
  },
  {
    name: 'Fatima Suleiman',
    role: 'Community Trust & Maternal Care Advisor',
    department: 'partnerships',
    location: 'Kumbotso South & Bichi North',
    experience: '12 years in Community Midwifery & Health Education',
    bio: 'Partners with traditional birth attendants, ward committees, and mothers to make clinic follow-ups welcoming for every family.',
    initials: 'FS',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onGoogleLogin,
  error,
  loading,
  isAuthenticated = false,
  onReturnToWorkspace,
  initialPage = 'home',
}) => {
  const [activePage, setActivePage] = useState<WebsitePage>(initialPage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  // Typewriter Effect State
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Live Sign-In Form State (Username & Password)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const signInSectionRef = useRef<HTMLDivElement | null>(null);

  // Services Filter State
  const [serviceCategory, setServiceCategory] = useState<
    'all' | 'field' | 'quality' | 'leadership'
  >('all');

  // Team Filter State & Selected Bio
  const [teamFilter, setTeamFilter] = useState<
    'all' | 'clinical' | 'product' | 'partnerships'
  >('all');
  const [selectedMember, setSelectedMember] = useState<(typeof TEAM_MEMBERS)[0] | null>(null);

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    clinicName: '',
    topic: 'Setup NEXORA for Our Clinic',
    message: '',
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Auto-advance carousel every 7.5 seconds when on Home page and not paused
  useEffect(() => {
    if (activePage !== 'home' || isCarouselPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
      setPhraseIndex(0);
      setTypedText('');
      setIsDeleting(false);
    }, 7500);
    return () => clearInterval(timer);
  }, [activePage, isCarouselPaused]);

  // Typewriting effect for active slide
  useEffect(() => {
    if (activePage !== 'home') return;
    const phrases = HERO_SLIDES[currentSlide].typewriterPhrases;
    const currentPhrase = phrases[phraseIndex % phrases.length];

    const typeSpeed = isDeleting ? 24 : 45;
    const timeout = setTimeout(() => {
      if (!isDeleting && typedText.length < currentPhrase.length) {
        setTypedText(currentPhrase.slice(0, typedText.length + 1));
      } else if (!isDeleting && typedText.length === currentPhrase.length) {
        setTimeout(() => setIsDeleting(true), 1600);
      } else if (isDeleting && typedText.length > 0) {
        setTypedText(currentPhrase.slice(0, typedText.length - 1));
      } else if (isDeleting && typedText.length === 0) {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [activePage, currentSlide, phraseIndex, typedText, isDeleting]);

  const handleSelectSlide = (index: number) => {
    setCurrentSlide(index);
    setPhraseIndex(0);
    setTypedText('');
    setIsDeleting(false);
  };

  const scrollToSignIn = () => {
    if (activePage !== 'home') {
      setActivePage('home');
      setTimeout(() => {
        signInSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    } else {
      signInSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(username.trim(), password);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    const cleanEmail = contactForm.email.trim();
    if (!contactForm.fullName.trim() || !cleanEmail || !contactForm.message.trim()) {
      setContactError('Please fill in your name, email address, and message so we can reply.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setContactError('Please enter a valid email address (for example: nurse@clinic.org).');
      return;
    }
    setContactSubmitted(true);
  };

  const navPages: Array<{ id: WebsitePage; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'services', label: 'Services' },
    { id: 'contact', label: 'Contact' },
    { id: 'team', label: 'Team' },
  ];

  const activeHero = HERO_SLIDES[currentSlide];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => {
            setActivePage('home');
            setMobileMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-lg sm:text-xl font-bold tracking-tight text-white font-display whitespace-nowrap text-left focus-visible:outline-2 focus-visible:outline-teal-400"
        >
          NEXORA Health
        </button>

        {/* Zone 2: Strictly the 5 requested navigation links */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {navPages.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActivePage(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-white border-teal-400 font-semibold'
                    : 'text-slate-300 border-transparent hover:text-white hover:border-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:block w-44">
            <PWAInstallButton />
          </div>

          {isAuthenticated && onReturnToWorkspace ? (
            <button
              type="button"
              onClick={onReturnToWorkspace}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Return to Clinic Portal →
            </button>
          ) : (
            <button
              type="button"
              onClick={scrollToSignIn}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Staff Sign In
            </button>
          )}

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 py-4 space-y-2 animate-fade-in">
          <div className="grid grid-cols-2 gap-1.5">
            {navPages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActivePage(item.id);
                  setMobileMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3.5 py-2.5 rounded-lg text-left text-xs font-semibold transition-colors ${
                  activePage === item.id
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-800 sm:hidden">
            <PWAInstallButton />
          </div>
        </div>
      )}

      {/* =====================================================================
          PAGE 1: HOME (3-Slider Carousel Hero with Typewriter + Live Login)
         ===================================================================== */}
      {activePage === 'home' && (
        <main className="flex-1 animate-fade-in">
          {/* 3-Slider Carousel Hero Section */}
          <section
            className="relative bg-slate-950 text-white overflow-hidden border-b border-slate-800"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
          >
            {/* Background Media with Measured Contrast Scrim & Resilient Fallback */}
            <div className="absolute inset-0">
              {!imgErrors[currentSlide] ? (
                <img
                  key={activeHero.image}
                  src={activeHero.image}
                  alt={activeHero.imageAlt}
                  referrerPolicy="no-referrer"
                  loading={currentSlide === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  onError={() =>
                    setImgErrors((prev) => ({
                      ...prev,
                      [currentSlide]: true,
                    }))
                  }
                  className="w-full h-full object-cover object-center opacity-35 transition-opacity duration-500"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-950 via-teal-950/60 to-slate-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/65" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                {/* Left Column: Carousel Content + Typewriting Effect */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Unboxed Kicker Metadata */}
                  <div className="flex items-center gap-2 text-xs text-teal-300 font-medium tracking-wide">
                    <span>{activeHero.kicker}</span>
                    <span aria-hidden="true">·</span>
                    <span>Primary Health Care Network</span>
                  </div>

                  {/* Dominant Headline */}
                  <h1
                    key={`headline-${activeHero.id}`}
                    className="font-display text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-white leading-[1.12] animate-slide-up"
                    style={{ textWrap: 'balance' }}
                  >
                    {activeHero.headline}
                  </h1>

                  {/* Live Typewriting Effect Line */}
                  <div className="min-h-[3.25rem] sm:min-h-[2.75rem] flex items-center">
                    <p className="text-base sm:text-xl font-semibold text-teal-300 leading-snug">
                      <span>{typedText}</span>
                      <span
                        aria-hidden="true"
                        className="inline-block w-0.5 h-5 sm:h-6 bg-teal-400 ml-1 align-middle animate-cursor"
                      />
                    </p>
                  </div>

                  {/* Clear User-Friendly Description */}
                  <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
                    {activeHero.description}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={scrollToSignIn}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs sm:text-sm transition-colors whitespace-nowrap"
                    >
                      <span>{activeHero.primaryCtaLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActivePage(activeHero.secondaryTargetPage);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-600 bg-slate-900/70 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap"
                    >
                      <span>{activeHero.secondaryCtaLabel}</span>
                    </button>
                  </div>

                  {/* Carousel Controls & Slide Selector Bar */}
                  <div className="pt-6 border-t border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {HERO_SLIDES.map((slide, idx) => (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => handleSelectSlide(idx)}
                          aria-label={`Show slide ${idx + 1}`}
                          className={`h-2 rounded-full transition-all ${
                            currentSlide === idx
                              ? 'w-10 bg-teal-400'
                              : 'w-3 bg-slate-700 hover:bg-slate-500'
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-xs text-slate-300 font-mono tabular-nums">
                        0{currentSlide + 1} / 0{HERO_SLIDES.length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="text-xs text-slate-300">{activeHero.proofMetric}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectSlide(
                              (currentSlide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length
                            )
                          }
                          aria-label="Previous slide"
                          className="p-2 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectSlide((currentSlide + 1) % HERO_SLIDES.length)
                          }
                          aria-label="Next slide"
                          className="p-2 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Operator Sign-In Card */}
                <div className="lg:col-span-5" ref={signInSectionRef} id="sign-in-portal">
                  <div className="rounded-xl bg-white text-slate-900 border border-slate-200 p-5 sm:p-7 shadow-xl">
                    <div className="border-b border-slate-100 pb-4 mb-5">
                      <div className="text-xs text-teal-700 font-semibold">
                        Authorized Staff Access
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                        Sign In to NEXORA Health
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Enter your operator username and password to access live patient records,
                        offline visit tools, and the AI Care Assistant.
                      </p>
                    </div>

                    <form onSubmit={handleSubmitLogin} className="space-y-4">
                      <div>
                        <label
                          htmlFor="login-username"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Username
                        </label>
                        <input
                          id="login-username"
                          type="text"
                          required
                          autoComplete="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                          placeholder="Enter your username"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="login-password"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 font-mono focus:border-teal-600 focus:outline-none"
                            placeholder="Enter your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 text-sm transition-colors disabled:opacity-50"
                      >
                        <span>
                          {loading ? 'Signing In...' : 'Sign In to Workspace'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-[11px] text-slate-400">OR GOOGLE ACCOUNT</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={onGoogleLogin}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 text-xs transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5 text-teal-600" />
                      <span>Continue with Google Account</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How NEXORA Works in 4 Simple Steps */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <div className="text-xs font-semibold text-teal-700">
                  Simple Everyday Workflow
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                  How NEXORA Helps Your Clinic Every Day
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md">
                No complicated training required. Register families, record visits with AI
                assistance, and keep follow-ups organized online or offline.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-teal-700">STEP 01</span>
                  <WifiOff className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Record Visits Anywhere
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Register patients and enter vital signs during home visits or busy clinic hours,
                  even when there is no mobile network.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-teal-700">STEP 02</span>
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  AI Care &amp; Safety Checks
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The app calculates patient age automatically, checks vital sign ranges, and helps
                  draft clear visit notes with AI support.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-teal-700">STEP 03</span>
                  <RefreshCw className="w-4 h-4 text-sky-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  One-Tap Clinic Sync
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your saved visits wait in a clear Pending Action list and sync to the main clinic
                  as soon as internet returns.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-teal-700">STEP 04</span>
                  <HeartHandshake className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Timely Follow-Up Care
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mothers, children, and referred patients are tracked automatically so no family
                  misses their next checkup.
                </p>
              </div>
            </div>
          </section>

          {/* Quantitative Proof & Attributable Community Voices */}
          <section className="bg-white border-y border-slate-200 py-14 sm:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-8 border-b border-slate-100">
                <div>
                  <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-slate-900">
                    100%
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">
                    Works Without Internet
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Every patient registration and health visit form works offline on phones and
                    tablets.
                  </p>
                </div>

                <div>
                  <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-teal-700">
                    AI-Powered
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">
                    Smart Visit &amp; Care Assistant
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time clinical note suggestions, triage priority guidance, and plain-language
                    clinic insights.
                  </p>
                </div>

                <div>
                  <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-slate-900">
                    &lt; 2 sec
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">
                    Instant Patient Lookup
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Find any returning mother or child by name, community, or clinic ID in seconds.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <blockquote className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    “Before NEXORA, rainy-season network outages meant we wrote everything on loose
                    paper and spent Friday afternoons copying notes. Now I record every maternal
                    visit on my tablet in the village and tap Sync when I get back to the clinic.”
                  </p>
                  <footer className="text-xs text-slate-500">
                    <strong className="text-slate-900">Amina Bello</strong> · Community Health
                    Coordinator · Ungogo Ward A Primary Health Center
                  </footer>
                </blockquote>

                <blockquote className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    “Instead of waiting until the end of the month to review clinic registers, we
                    can see live visit trends right away and use the AI Care Assistant to support
                    frontline nurses.”
                  </p>
                  <footer className="text-xs text-slate-500">
                    <strong className="text-slate-900">Dr. Tunde Okonkwo</strong> · Chief Medical
                    Officer · Primary Health Care Network
                  </footer>
                </blockquote>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* =====================================================================
          PAGE 2: ABOUT
         ===================================================================== */}
      {activePage === 'about' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12 animate-fade-in">
          <div className="max-w-3xl space-y-4">
            <div className="text-xs font-semibold text-teal-700">
              About NEXORA Health · Built for Frontline Care
            </div>
            <h1
              className="font-display text-3xl sm:text-5xl font-bold text-slate-900 leading-tight"
              style={{ textWrap: 'balance' }}
            >
              We believe where you live should never determine whether your health record is remembered.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Across thousands of community clinics and rural outreach posts, dedicated nurses and
              health workers care for families every day. Yet most health software stops working
              the moment mobile internet drops. NEXORA Health was built alongside frontline workers
              in Nigeria to bridge that gap.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
              <div className="text-xs font-mono font-semibold text-teal-700">01. OUR MISSION</div>
              <h2 className="text-lg font-bold text-slate-900">
                Support Every Health Worker
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Give community health workers a fast, calm tool that saves them time during patient
                visits and never loses their work when the network goes down.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
              <div className="text-xs font-mono font-semibold text-teal-700">02. OUR APPROACH</div>
              <h2 className="text-lg font-bold text-slate-900">
                Plain Language &amp; Smart AI
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Healthcare tools should speak the language of care. We combine clear checklists,
                automatic age calculation, and an AI Care Assistant that helps staff write clear
                clinical notes.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
              <div className="text-xs font-mono font-semibold text-teal-700">03. OUR PROMISE</div>
              <h2 className="text-lg font-bold text-slate-900">
                Respect for Patient Privacy
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                We follow Nigeria Data Protection Act (NDPA) 2023 safeguards—collecting only what
                is needed for safe care and always honoring patient consent.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                Ready to access the NEXORA Health portal?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Explore our services or sign in with your operator credentials to manage live
                patient records and AI clinical insights.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActivePage('services')}
                className="px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
              >
                Explore Services →
              </button>
              <button
                type="button"
                onClick={scrollToSignIn}
                className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Staff Sign In
              </button>
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          PAGE 3: SERVICES
         ===================================================================== */}
      {activePage === 'services' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 animate-fade-in">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-6">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-semibold text-teal-700">
                What We Provide · Built for Clinics &amp; Outreach Teams
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
                Our Services
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Everything a primary health center needs to register families, record daily visits
                with or without internet, and coordinate follow-up care with AI support.
              </p>
            </div>

            {/* Interactive Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
              {(
                [
                  { id: 'all', label: 'All Services' },
                  { id: 'field', label: 'Frontline Care' },
                  { id: 'quality', label: 'AI & Accuracy' },
                  { id: 'leadership', label: 'Clinic Leadership' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setServiceCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    serviceCategory === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES_LIST.filter((s) =>
              serviceCategory === 'all' ? true : s.category === serviceCategory
            ).map((service) => (
              <div
                key={service.number}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4 hover:border-teal-600/50 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono font-bold text-teal-700">
                      {service.number}. SERVICE
                    </span>
                    <span>{service.outcome}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{service.title}</h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={scrollToSignIn}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                  >
                    Open in Clinic Portal →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePage('contact')}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Ask a Question
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* =====================================================================
          PAGE 4: CONTACT
         ===================================================================== */}
      {activePage === 'contact' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column: Direct Contact Info */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-teal-700">
                  Get in Touch · Friendly Human Support
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
                  Contact Our Team
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Have a question about bringing NEXORA Health to your clinic, training community
                  health workers, or getting help with your device? Send us a message and our regional
                  team will respond promptly.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900">Regional Clinic Support Hub</div>
                    <div className="text-slate-600 mt-0.5">
                      14 Hospital Road, Nassarawa GRA, Kano State, Nigeria
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900">Toll-Free Health Worker Helpline</div>
                    <div className="text-slate-600 font-mono tabular-nums mt-0.5">
                      +234 (0) 800-NEXORA-CARE · +234 803 555 0140
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900">Email Address</div>
                    <div className="text-slate-600 mt-0.5">care@nexora.health</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900">Support Hours</div>
                    <div className="text-slate-600 mt-0.5">
                      Monday – Saturday: 7:00 AM – 8:00 PM WAT (Emergency line open 24/7)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Validated Contact Form */}
            <div className="lg:col-span-7">
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                {contactSubmitted ? (
                  <div className="py-8 text-center space-y-4 animate-fade-in">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-slate-900">
                        Thank you, {contactForm.fullName}!
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                        We have received your message regarding{' '}
                        <strong>{contactForm.topic}</strong>. Our clinic coordinator will reply to{' '}
                        <span className="font-mono">{contactForm.email}</span> within one business
                        day.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setContactSubmitted(false);
                        setContactForm({
                          fullName: '',
                          email: '',
                          phone: '',
                          clinicName: '',
                          topic: 'Setup NEXORA for Our Clinic',
                          message: '',
                        });
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4 text-xs" noValidate>
                    <h2 className="text-lg font-bold text-slate-900">Send Us a Message</h2>

                    {contactError && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-amber-900">
                        {contactError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Your Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactForm.fullName}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, fullName: e.target.value })
                          }
                          placeholder="Enter your full name"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, email: e.target.value })
                          }
                          placeholder="you@clinic.org"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Phone or WhatsApp Number
                        </label>
                        <input
                          type="tel"
                          value={contactForm.phone}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, phone: e.target.value })
                          }
                          placeholder="+234 803 000 0000"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Clinic or Community Name
                        </label>
                        <input
                          type="text"
                          value={contactForm.clinicName}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, clinicName: e.target.value })
                          }
                          placeholder="Enter clinic or ward name"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        How Can We Help?
                      </label>
                      <select
                        value={contactForm.topic}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, topic: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:border-teal-600 focus:outline-none"
                      >
                        <option value="Setup NEXORA for Our Clinic">
                          Setup NEXORA for Our Clinic
                        </option>
                        <option value="Health Worker Tablet Training">
                          Health Worker Tablet Training
                        </option>
                        <option value="District Hospital Partnership">
                          District Hospital Partnership
                        </option>
                        <option value="General Question or Feedback">
                          General Question or Feedback
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Your Message *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={contactForm.message}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, message: e.target.value })
                        }
                        placeholder="Tell us about your clinic or how we can support your team..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-colors"
                    >
                      Send Message
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          PAGE 5: TEAM
         ===================================================================== */}
      {activePage === 'team' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 animate-fade-in">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-6">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-semibold text-teal-700">
                People Behind NEXORA Health
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
                Meet Our Team
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Doctors, community health nurses, and offline-systems engineers working side by side
                to support local clinics across Nigeria.
              </p>
            </div>

            {/* Department Filter */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
              {(
                [
                  { id: 'all', label: 'All Team (6)' },
                  { id: 'clinical', label: 'Doctors & Nurses' },
                  { id: 'product', label: 'Offline & Privacy' },
                  { id: 'partnerships', label: 'Clinic Support' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTeamFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    teamFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEAM_MEMBERS.filter((m) =>
              teamFilter === 'all' ? true : m.department === teamFilter
            ).map((member) => (
              <div
                key={member.name}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4 hover:border-teal-600/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-teal-950 text-teal-300 font-bold text-sm flex items-center justify-center shrink-0">
                      {member.initials}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{member.name}</h2>
                      <div className="text-xs text-teal-700 font-medium">{member.role}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">
                    {member.location} · {member.experience}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{member.bio}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    className="font-semibold text-slate-900 hover:text-teal-700 hover:underline"
                  >
                    View Profile Details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactForm((prev) => ({
                        ...prev,
                        topic: 'General Question or Feedback',
                        message: `Hello ${member.name}, I would like to connect regarding NEXORA Health.`,
                      }));
                      setActivePage('contact');
                    }}
                    className="text-teal-700 hover:underline font-medium"
                  >
                    Message →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Team Member Detail Modal */}
          {selectedMember && (
            <div
              className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
              role="dialog"
              aria-modal="true"
            >
              <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-950 text-teal-300 font-bold text-sm flex items-center justify-center shrink-0">
                      {selectedMember.initials}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{selectedMember.name}</h3>
                      <p className="text-xs text-teal-700 font-medium">{selectedMember.role}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                    aria-label="Close member profile"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-500 border-y border-slate-100 py-2.5">
                  Location: <strong className="text-slate-800">{selectedMember.location}</strong> ·{' '}
                  {selectedMember.experience}
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {selectedMember.bio}
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const member = selectedMember;
                      setSelectedMember(null);
                      setContactForm((prev) => ({
                        ...prev,
                        message: `Hello ${member.name}, I would like to connect with you.`,
                      }));
                      setActivePage('contact');
                    }}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                  >
                    Send Message to {selectedMember.name.split(' ')[0]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Functional Footer with Privacy Policy, Terms of Use, Cookies, and Page Links */}
      <SiteFooter
        onNavigatePage={(page) => setActivePage(page)}
        onOpenSignIn={scrollToSignIn}
        variant="dark"
      />
    </div>
  );
};
