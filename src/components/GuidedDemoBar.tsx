import React from 'react';
import { Play, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';

export interface DemoStep {
  step: number;
  title: string;
  description: string;
  actionLabel: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    step: 1,
    title: 'Supervisor Dashboard Baseline',
    description: 'Supervisor dashboard displays current district encounters, active CHWs, and data quality alerts.',
    actionLabel: 'View Supervisor Dashboard',
  },
  {
    step: 2,
    title: 'Switch to Frontline Worker',
    description: 'Switch role to Frontline Worker (Amina Bello, CHW-014) operating in Ungogo Ward A.',
    actionLabel: 'Switch to Frontline Worker',
  },
  {
    step: 3,
    title: 'Activate Simulated Offline Mode',
    description: 'Simulate rural clinic connectivity loss. Server sync pauses while local IndexedDB storage remains active.',
    actionLabel: 'Enable Offline Mode',
  },
  {
    step: 4,
    title: 'Create Patient Encounter #1',
    description: 'Open New Health Encounter form with pre-filled febrile triage assessment while offline.',
    actionLabel: 'Prepare Offline Encounter #1',
  },
  {
    step: 5,
    title: 'Save Encounter #1 to IndexedDB',
    description: 'Validate locally and store Encounter #1 in browser IndexedDB synchronization queue.',
    actionLabel: 'Save Encounter #1 Locally',
  },
  {
    step: 6,
    title: 'Create & Save Second Offline Encounter',
    description: 'Capture a second offline encounter (including a potential duplicate / review case) into the local queue.',
    actionLabel: 'Capture Offline Encounter #2',
  },
  {
    step: 7,
    title: 'Restore Network Connectivity',
    description: 'Disable Simulated Offline Mode to simulate the worker returning to cellular coverage.',
    actionLabel: 'Restore Online Connection',
  },
  {
    step: 8,
    title: 'Open Synchronization Center',
    description: 'Inspect the pending offline records waiting in the local device synchronization queue.',
    actionLabel: 'Open Sync Center',
  },
  {
    step: 9,
    title: 'Synchronize Pending Queue Now',
    description: 'Transmit pending IndexedDB records to PostgreSQL, run validation, and confirm server receipt.',
    actionLabel: 'Trigger Sync Now',
  },
  {
    step: 10,
    title: 'Return to Supervisor Dashboard',
    description: 'Switch back to Supervisor role and observe the newly synchronized encounters reflected live.',
    actionLabel: 'Open Supervisor Dashboard',
  },
  {
    step: 11,
    title: 'Review Data Quality & Duplicate Detection',
    description: 'Inspect flagged potential duplicates and version conflicts in the Data Quality center.',
    actionLabel: 'Open Data Quality Center',
  },
  {
    step: 12,
    title: 'Review NEXORA Intelligence',
    description: 'Examine automated & AI-assisted operational insights generated from the updated health records.',
    actionLabel: 'Open NEXORA Intelligence',
  },
];

interface GuidedDemoBarProps {
  isOpen: boolean;
  currentStep: number;
  onClose: () => void;
  onSelectStep: (step: number) => void;
  onExecuteStep: (step: number) => void;
}

export const GuidedDemoBar: React.FC<GuidedDemoBarProps> = ({
  isOpen,
  currentStep,
  onClose,
  onSelectStep,
  onExecuteStep,
}) => {
  if (!isOpen) return null;

  const active = DEMO_STEPS.find((s) => s.step === currentStep) || DEMO_STEPS[0];

  return (
    <div className="border-b border-teal-800/60 bg-slate-900 text-white px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-teal-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guided Demo · Step {active.step}/12</span>
          </div>
          <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
          <div className="text-xs sm:text-sm">
            <span className="font-semibold text-white">{active.title}: </span>
            <span className="text-slate-300">{active.description}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={currentStep <= 1}
            onClick={() => onSelectStep(Math.max(1, currentStep - 1))}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            title="Previous Step"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onExecuteStep(active.step)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{active.actionLabel}</span>
          </button>

          <button
            type="button"
            disabled={currentStep >= 12}
            onClick={() => onSelectStep(Math.min(12, currentStep + 1))}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            title="Next Step"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            title="Hide Guided Demo Bar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
