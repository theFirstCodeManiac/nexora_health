import React, { useState } from 'react';
import { ShieldCheck, WifiOff, RefreshCw, Database, ArrowRight, Lock } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface LoginViewProps {
  onDemoLogin: (email: string, password: string, role: 'worker' | 'supervisor') => Promise<void>;
  onGoogleLogin: (role: 'worker' | 'supervisor') => Promise<void>;
  error: string | null;
  loading: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onDemoLogin,
  onGoogleLogin,
  error,
  loading,
}) => {
  const [email, setEmail] = useState('worker@nexora.health');
  const [password, setPassword] = useState('Demo123!');
  const [role, setRole] = useState<'worker' | 'supervisor'>('worker');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onDemoLogin(email, password, role);
  };

  const selectPreset = (presetRole: 'worker' | 'supervisor') => {
    setRole(presetRole);
    if (presetRole === 'worker') {
      setEmail('worker@nexora.health');
      setPassword('Demo123!');
    } else {
      setEmail('supervisor@nexora.health');
      setPassword('Demo123!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Bar Contract */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
        <a href="#top" className="text-lg font-bold tracking-tight text-white">
          NEXORA Health
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a href="#offline-engine" className="hover:text-white transition-colors whitespace-nowrap">
            Offline Capture
          </a>
          <a href="#sync-protocol" className="hover:text-white transition-colors whitespace-nowrap">
            Sync Protocol
          </a>
          <a href="#fhir-ready" className="hover:text-white transition-colors whitespace-nowrap">
            Interoperability
          </a>
          <a href="#ndpa-security" className="hover:text-white transition-colors whitespace-nowrap">
            NDPA Security
          </a>
        </nav>
        <div className="flex items-center gap-3 w-56">
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Mission & Architecture Overview */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-teal-950 border border-teal-700/50 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 64 64" fill="none">
                  <path
                    d="M26 12H38V26H52V38H38V52H26V38H12V26H26V12Z"
                    stroke="#14B8A6"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="32" cy="12" r="4" fill="#38BDF8" />
                  <circle cx="32" cy="52" r="4" fill="#38BDF8" />
                  <circle cx="12" cy="32" r="4" fill="#38BDF8" />
                  <circle cx="52" cy="32" r="4" fill="#38BDF8" />
                  <circle cx="32" cy="32" r="5" fill="#F8FAFC" />
                </svg>
              </div>
              <div className="text-xs font-mono text-teal-400">
                FRONTLINE HEALTH DATA INFRASTRUCTURE · NIGERIA PHC NETWORK
              </div>
            </div>

            <div className="space-y-4">
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Connecting frontline data to better health decisions.
              </h1>
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                NEXORA Health enables community health workers operating in low-connectivity
                environments to capture structured clinical encounters offline, validate locally in
                IndexedDB, and synchronize into standardized intelligence when connectivity returns.
              </p>
            </div>

            {/* End-to-End Pipeline Flow */}
            <div id="offline-engine" className="pt-2 border-t border-slate-800/80 space-y-3">
              <div className="text-xs font-mono text-slate-400">
                END-TO-END OPERATIONAL DATA PIPELINE
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-white mb-1">
                    <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>01. Offline Capture</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Zero-latency encounter & vitals intake stored in local IndexedDB.
                  </p>
                </div>
                <div id="sync-protocol" className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-white mb-1">
                    <RefreshCw className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>02. Queue & Sync</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Resilient batch transmission & version conflict resolution.
                  </p>
                </div>
                <div id="fhir-ready" className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-white mb-1">
                    <Database className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>03. Validate & FHIR</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Duplicate detection, physiological range checks & FHIR R4 export.
                  </p>
                </div>
                <div id="ndpa-security" className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-white mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>04. Act & Audit</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Supervisor follow-up dispatch, AI operational briefs & audit trail.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Login Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl bg-white text-slate-900 border border-slate-200 p-6 sm:p-8 shadow-xl">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h2 className="text-xl font-bold text-slate-900">Operator Sign In</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Select a demo role or authenticate with credentials to access NEXORA Health.
                </p>
              </div>

              {/* Quick Demo Account Selector */}
              <div className="mb-6 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Quick Hackathon Demo Accounts
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => selectPreset('worker')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      role === 'worker'
                        ? 'border-teal-600 bg-teal-50/70 text-slate-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Frontline Worker</div>
                    <div className="text-[11px] font-mono text-slate-600 truncate mt-0.5">
                      worker@nexora.health
                    </div>
                    <div className="text-[11px] text-teal-700 mt-1">
                      Offline capture · Sync queue
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectPreset('supervisor')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      role === 'supervisor'
                        ? 'border-teal-600 bg-teal-50/70 text-slate-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">District Supervisor</div>
                    <div className="text-[11px] font-mono text-slate-600 truncate mt-0.5">
                      supervisor@nexora.health
                    </div>
                    <div className="text-[11px] text-teal-700 mt-1">
                      Quality alerts · Intelligence
                    </div>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    placeholder="worker@nexora.health"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 font-mono focus:border-teal-600 focus:outline-none"
                    placeholder="Demo123!"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Demo password: Demo123!
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorized Role Scope
                  </label>
                  <select
                    value={role}
                    onChange={(e) => selectPreset(e.target.value as 'worker' | 'supervisor')}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:border-teal-600 focus:outline-none"
                  >
                    <option value="worker">Frontline Worker (CHW Field Mode)</option>
                    <option value="supervisor">Supervisor (District Operations & Quality)</option>
                  </select>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 text-sm transition-colors disabled:opacity-50"
                >
                  <span>
                    {loading
                      ? 'Authenticating Session...'
                      : `Sign In as ${role === 'supervisor' ? 'Supervisor' : 'Frontline Worker'}`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] text-slate-400">OR GOOGLE SSO</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => onGoogleLogin(role)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 text-xs transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-teal-600" />
                <span>Continue with Google Workspace Auth ({role})</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="px-6 py-4 border-t border-slate-900 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>NEXORA Health Infrastructure · Offline-First Clinical Data Synchronization</span>
        <span>Designed with Nigeria Data Protection Act (NDPA) 2023 Data Minimization Principles</span>
      </footer>
    </div>
  );
};
