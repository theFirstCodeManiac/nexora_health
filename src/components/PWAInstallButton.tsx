import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

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
        className="flex items-center gap-2 rounded-lg border border-teal-700/40 bg-teal-950/60 px-3 py-2 text-xs font-medium text-teal-200 hover:bg-teal-900/70 transition-colors whitespace-nowrap w-full justify-center"
      >
        <Download className="w-3.5 h-3.5 shrink-0 text-teal-400" />
        <span>Install NEXORA on this device</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl text-slate-900">
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
              <p>
                NEXORA Health is configured with a Service Worker, precached offline shell, and
                IndexedDB encrypted-ready local queue for disconnected clinics.
              </p>
              {isIOS ? (
                <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-900">iOS / iPadOS Installation:</p>
                  <p>1. Tap the <strong>Share</strong> button in the Safari toolbar.</p>
                  <p>2. Select <strong>Add to Home Screen</strong> to launch NEXORA standalone.</p>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-900">Field Tablet / Desktop Installation:</p>
                  <p>1. Open the application in a top-level browser tab.</p>
                  <p>2. Click the browser address bar <strong>Install NEXORA</strong> icon or menu option <strong>Install App</strong>.</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-teal-700 pt-1">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Offline shell · Local IndexedDB storage · Auto-reconnection queue active</span>
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
