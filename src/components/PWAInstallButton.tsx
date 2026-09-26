import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, CheckCircle2, HardDrive } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import {
  getServiceWorkerCacheStats,
  ServiceWorkerCacheStats,
} from '../lib/serviceWorkerManager.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [cacheStats, setCacheStats] = useState<ServiceWorkerCacheStats | null>(null);

  useEffect(() => {
    if (showGuideModal) {
      getServiceWorkerCacheStats().then(setCacheStats);
    }
  }, [showGuideModal]);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg border border-teal-700/40 bg-teal-950/60 px-2.5 sm:px-3 py-2 text-xs font-medium text-teal-200 hover:bg-teal-900/70 transition-colors whitespace-nowrap w-full justify-center"
      >
        <Download className="w-3.5 h-3.5 shrink-0 text-teal-400" />
        <span className="truncate">Install NEXORA on this device</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xl text-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-teal-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Install NEXORA on this device
                  </h3>
                  <p className="text-xs text-slate-500">
                    Offline-First Frontline Health Infrastructure PWA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="text-xs leading-relaxed">
                NEXORA Health runs a dedicated Service Worker (<code>/sw-offline.js</code>) that
                precaches core application shell assets and critical API routes (
                <code>/api/bootstrap</code>, <code>/api/auth/session</code>) alongside IndexedDB
                encounter persistence.
              </p>

              {cacheStats && (
                <div className="rounded-lg bg-slate-900 text-slate-100 p-3.5 text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-teal-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Service Worker Cache Status</span>
                    </span>
                    <span>{cacheStats.activeState}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Core Shell & Manifest Assets:</span>
                    <span className="tabular-nums">{cacheStats.coreAssetsCount} cached</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Runtime UI Modules & Fonts:</span>
                    <span className="tabular-nums">{cacheStats.runtimeAssetsCount} cached</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Cached Critical API Routes:</span>
                    <span className="tabular-nums">
                      {cacheStats.apiRoutesCached.length > 0
                        ? cacheStats.apiRoutesCached.join(', ')
                        : '/api/bootstrap, /api/auth/session'}
                    </span>
                  </div>
                </div>
              )}

              {isIOS ? (
                <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-900">iOS / iPadOS Installation:</p>
                  <p>
                    1. Tap the <strong>Share</strong> button in the Safari toolbar.
                  </p>
                  <p>
                    2. Select <strong>Add to Home Screen</strong> to launch NEXORA standalone.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-900">
                    Field Tablet / Desktop Installation:
                  </p>
                  <p>1. Open the application in a top-level browser tab.</p>
                  <p>
                    2. Click the browser address bar <strong>Install NEXORA</strong> icon or menu
                    option <strong>Install App</strong>.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-teal-700 pt-1">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Offline shell · Cached API routes · IndexedDB queue active
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
