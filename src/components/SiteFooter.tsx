import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, Phone, Mail, MapPin } from 'lucide-react';

export type WebsitePage = 'home' | 'about' | 'services' | 'contact' | 'team';
export type LegalModalTopic =
  | 'privacy'
  | 'terms'
  | 'cookies'
  | 'consent'
  | 'accessibility'
  | 'support'
  | null;

interface SiteFooterProps {
  onNavigatePage?: (page: WebsitePage) => void;
  onOpenSignIn?: () => void;
  variant?: 'dark' | 'light';
}

export const SiteFooter: React.FC<SiteFooterProps> = ({
  onNavigatePage,
  onOpenSignIn,
  variant = 'dark',
}) => {
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalTopic>(null);
  const [cookiePrefs, setCookiePrefs] = useState({
    essential: true,
    offlineStorage: true,
    performance: false,
  });
  const [cookieSavedNotice, setCookieSavedNotice] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexora_cookie_prefs');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCookiePrefs({
          essential: true,
          offlineStorage: Boolean(parsed.offlineStorage ?? true),
          performance: Boolean(parsed.performance ?? false),
        });
      }
    } catch {
      // Ignore storage read issues
    }
  }, []);

  const handleSaveCookiePrefs = () => {
    try {
      localStorage.setItem('nexora_cookie_prefs', JSON.stringify(cookiePrefs));
    } catch {
      // Ignore storage write issues
    }
    setCookieSavedNotice(true);
    setTimeout(() => {
      setCookieSavedNotice(false);
      setActiveLegalModal(null);
    }, 1100);
  };

  const handlePageClick = (page: WebsitePage) => {
    if (onNavigatePage) {
      onNavigatePage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isDark = variant === 'dark';

  return (
    <>
      <footer
        className={
          isDark
            ? 'bg-slate-950 text-slate-400 border-t border-slate-800/80'
            : 'bg-white text-slate-600 border-t border-slate-200'
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 pb-8 border-b border-slate-800/40">
            {/* Brand & Mission Summary */}
            <div className="lg:col-span-4 space-y-3">
              <button
                type="button"
                onClick={() => handlePageClick('home')}
                className={`text-lg font-bold tracking-tight font-display text-left transition-colors ${
                  isDark ? 'text-white hover:text-teal-400' : 'text-slate-900 hover:text-teal-700'
                }`}
              >
                NEXORA Health
              </button>
              <p className="text-xs leading-relaxed max-w-sm">
                Helping community health workers and local clinics care for patients smoothly—even
                when mobile internet is slow or unavailable.
              </p>
              <div className="pt-1 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span>Primary Health Care Network · Kano &amp; Kaduna, Nigeria</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span className="font-mono tabular-nums">+234 (0) 800-NEXORA-CARE</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span>care@nexora.health</span>
                </div>
              </div>
            </div>

            {/* Main Website Pages */}
            <div className="lg:col-span-3 space-y-2.5">
              <div
                className={`text-xs font-semibold ${
                  isDark ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                Main Pages
              </div>
              <ul className="space-y-2 text-xs">
                {(
                  [
                    { id: 'home', label: 'Home' },
                    { id: 'about', label: 'About' },
                    { id: 'services', label: 'Services' },
                    { id: 'contact', label: 'Contact' },
                    { id: 'team', label: 'Team' },
                  ] as Array<{ id: WebsitePage; label: string }>
                ).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handlePageClick(item.id)}
                      className={`hover:underline transition-colors ${
                        isDark ? 'hover:text-white' : 'hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal, Privacy & Cookies */}
            <div className="lg:col-span-3 space-y-2.5">
              <div
                className={`text-xs font-semibold ${
                  isDark ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                Legal &amp; Patient Trust
              </div>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('privacy')}
                    className={`hover:underline transition-colors ${
                      isDark ? 'hover:text-white' : 'hover:text-slate-900'
                    }`}
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('terms')}
                    className={`hover:underline transition-colors ${
                      isDark ? 'hover:text-white' : 'hover:text-slate-900'
                    }`}
                  >
                    Terms of Use
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('cookies')}
                    className={`hover:underline transition-colors ${
                      isDark ? 'hover:text-white' : 'hover:text-slate-900'
                    }`}
                  >
                    Cookies &amp; Offline Storage
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('consent')}
                    className={`hover:underline transition-colors ${
                      isDark ? 'hover:text-white' : 'hover:text-slate-900'
                    }`}
                  >
                    Patient Consent Charter
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('accessibility')}
                    className={`hover:underline transition-colors ${
                      isDark ? 'hover:text-white' : 'hover:text-slate-900'
                    }`}
                  >
                    Accessibility Statement
                  </button>
                </li>
              </ul>
            </div>

            {/* Quick Help & Clinic Access */}
            <div className="lg:col-span-2 space-y-2.5">
              <div
                className={`text-xs font-semibold ${
                  isDark ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                Clinic Support
              </div>
              <ul className="space-y-2 text-xs">
                {onOpenSignIn && (
                  <li>
                    <button
                      type="button"
                      onClick={onOpenSignIn}
                      className={`font-semibold hover:underline transition-colors ${
                        isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-800'
                      }`}
                    >
                      Staff Sign In →
                    </button>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalModal('support')}
                    className={`hover:underline transition-colors ${
                      isDark ? 'hover:text-white' : 'hover:text-slate-900'
                    }`}
                  >
                    24/7 Clinic Helpdesk
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handlePageClick('contact')}
                    className={`hover:underline transition-colors ${
                      isDark ? 'hover:text-white' : 'hover:text-slate-900'
                    }`}
                  >
                    Request Clinic Setup
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Quick Links Row */}
          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              © {new Date().getFullYear()} NEXORA Health. Built for community health workers and
              primary care clinics.
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveLegalModal('privacy')}
                className="hover:underline"
              >
                Privacy Policy
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveLegalModal('terms')}
                className="hover:underline"
              >
                Terms of Use
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveLegalModal('cookies')}
                className="hover:underline"
              >
                Cookies
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveLegalModal('support')}
                className="hover:underline"
              >
                Help
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Functional Modal for Privacy Policy, Terms of Use, Cookies, Patient Consent, Accessibility, and Support */}
      {activeLegalModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white text-slate-900 border border-slate-200 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">
                  {activeLegalModal === 'privacy' && 'Privacy Policy'}
                  {activeLegalModal === 'terms' && 'Terms of Use'}
                  {activeLegalModal === 'cookies' && 'Cookies & Offline Device Storage'}
                  {activeLegalModal === 'consent' && 'Patient Consent & Data Care Charter'}
                  {activeLegalModal === 'accessibility' && 'Accessibility Statement'}
                  {activeLegalModal === 'support' && '24/7 Community Clinic Helpdesk'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveLegalModal(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              {activeLegalModal === 'privacy' && (
                <>
                  <p className="font-medium text-slate-900">
                    Effective Date: September 2026 · Plain-Language Privacy Commitment
                  </p>
                  <p>
                    NEXORA Health is designed to protect patient dignity and privacy at every step.
                    We only collect the essential information needed to deliver safe primary health
                    care and follow-up visits—such as patient name, date of birth, community ward,
                    vital signs, and visit notes.
                  </p>
                  <div className="space-y-2 pt-1">
                    <h4 className="font-bold text-slate-900">1. Minimal Data Collection</h4>
                    <p>
                      Following the Nigeria Data Protection Act (NDPA) 2023 principles, we never
                      collect unnecessary personal details, financial data, or biometric trackers.
                    </p>
                    <h4 className="font-bold text-slate-900">2. Safe Offline Storage</h4>
                    <p>
                      When health workers record visits without internet, records are kept safely on
                      the authorized clinic tablet or phone until a connection is available to sync
                      with the central clinic register.
                    </p>
                    <h4 className="font-bold text-slate-900">3. Strict Role Access</h4>
                    <p>
                      Community health workers only see patients in their assigned care area, and
                      every record view or update is logged for clinic accountability.
                    </p>
                  </div>
                </>
              )}

              {activeLegalModal === 'terms' && (
                <>
                  <p className="font-medium text-slate-900">
                    NEXORA Health Platform Terms of Use
                  </p>
                  <p>
                    By accessing NEXORA Health, clinic staff and supervisors agree to use this
                    service responsibly for community health care delivery, patient registration,
                    and follow-up coordination.
                  </p>
                  <div className="space-y-2 pt-1">
                    <h4 className="font-bold text-slate-900">1. Supportive Care Tool</h4>
                    <p>
                      NEXORA Health helps organize patient records, check vital sign ranges, and
                      highlight overdue follow-ups. It does not replace the clinical judgment of
                      trained nurses, doctors, or community health workers.
                    </p>
                    <h4 className="font-bold text-slate-900">2. Authorized Clinic Use</h4>
                    <p>
                      Please keep your sign-in details private and always verify patient consent
                      before registering new family members.
                    </p>
                    <h4 className="font-bold text-slate-900">3. Accurate Record Keeping</h4>
                    <p>
                      When working offline, please sync your device regularly once you return to
                      clinic Wi-Fi or mobile coverage so supervisors can coordinate referrals.
                    </p>
                  </div>
                </>
              )}

              {activeLegalModal === 'cookies' && (
                <>
                  <p className="font-medium text-slate-900">
                    How We Use Cookies &amp; Local Device Storage
                  </p>
                  <p>
                    Unlike advertising websites, NEXORA Health does not use tracking or marketing
                    cookies. We use browser storage strictly to keep your app working smoothly when
                    the internet goes out.
                  </p>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          Essential Sign-In &amp; Security (Always Active)
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Keeps your operator session secure while you move between screens.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={cookiePrefs.essential}
                        disabled
                        className="mt-1"
                      />
                    </label>

                    <label className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          Offline Visit Storage (Recommended)
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Saves patient registrations and health visits on your device when you have
                          no internet connection.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={cookiePrefs.offlineStorage}
                        onChange={(e) =>
                          setCookiePrefs({ ...cookiePrefs, offlineStorage: e.target.checked })
                        }
                        className="mt-1"
                      />
                    </label>

                    <label className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          Anonymous Speed &amp; Reliability Checks
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Helps our engineering team keep page loading fast on low-power field
                          tablets.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={cookiePrefs.performance}
                        onChange={(e) =>
                          setCookiePrefs({ ...cookiePrefs, performance: e.target.checked })
                        }
                        className="mt-1"
                      />
                    </label>
                  </div>

                  {cookieSavedNotice && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Your storage preferences have been saved.</span>
                    </div>
                  )}
                </>
              )}

              {activeLegalModal === 'consent' && (
                <>
                  <p className="font-medium text-slate-900">
                    Respectful Patient Consent in Every Community
                  </p>
                  <p>
                    Every patient registered in NEXORA Health must give informed verbal or written
                    consent in a language they understand (Hausa, English, Yoruba, Igbo, or Pidgin)
                    before their information is recorded.
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Patients always know why their health visit is being recorded.</li>
                    <li>Patients can request corrections to their contact or family details at any clinic visit.</li>
                    <li>Emergency hospital referrals are shared only with the receiving medical team.</li>
                  </ul>
                </>
              )}

              {activeLegalModal === 'accessibility' && (
                <>
                  <p className="font-medium text-slate-900">
                    Built for Clear Reading Indoors and Outdoors
                  </p>
                  <p>
                    Field health workers often work in bright sunlight, busy clinics, or low-light
                    evening outreach. NEXORA Health follows WCAG AA contrast standards, clear button
                    sizing for touchscreens, keyboard navigation, and plain-language labels.
                  </p>
                </>
              )}

              {activeLegalModal === 'support' && (
                <>
                  <p className="font-medium text-slate-900">
                    Need a Hand? Our Field Support Team Is Ready
                  </p>
                  <p>
                    Whether you are a community health worker needing help with a tablet sync or a
                    clinic director setting up a new ward, reach out to us directly:
                  </p>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div>
                      <strong>Toll-Free Field Helpline:</strong>{' '}
                      <span className="font-mono">+234 (0) 800-NEXORA-CARE</span>
                    </div>
                    <div>
                      <strong>WhatsApp &amp; SMS Support:</strong>{' '}
                      <span className="font-mono">+234 803 555 0140</span>
                    </div>
                    <div>
                      <strong>Email Support:</strong> care@nexora.health
                    </div>
                    <div>
                      <strong>Regional Office:</strong> 14 Hospital Road, Nassarawa GRA, Kano
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              {activeLegalModal === 'cookies' ? (
                <button
                  type="button"
                  onClick={handleSaveCookiePrefs}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Save Preferences
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveLegalModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
