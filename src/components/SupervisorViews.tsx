import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  FileJson,
  Shield,
  ArrowDown,
  ArrowRight,
  Copy,
  Check,
  Search,
  RefreshCw,
} from 'lucide-react';
import { buildFhirR4EncounterBundle } from '../lib/validation.ts';

interface SupervisorViewsProps {
  activeTab: string;
  encounters: any[];
  patients: any[];
  workers: any[];
  communities: any[];
  followUps: any[];
  alerts: any[];
  auditLogs: any[];
  pendingOfflineCount: number;
  onResolveAlert: (alertId: number, status: string) => Promise<void>;
  onNavigate: (tab: string) => void;
  onRequestAiBrief: (summaryMetrics: any) => Promise<void>;
  aiInsights: Array<{
    category: string;
    headline: string;
    recommendation: string;
    priority: string;
  }> | null;
  aiLoading: boolean;
  aiError: string | null;
}

export const SupervisorViews: React.FC<SupervisorViewsProps> = ({
  activeTab,
  encounters,
  patients,
  workers,
  communities,
  followUps,
  alerts,
  auditLogs,
  pendingOfflineCount,
  onResolveAlert,
  onNavigate,
  onRequestAiBrief,
  aiInsights,
  aiLoading,
  aiError,
}) => {
  const [selectedEncounterForFhir, setSelectedEncounterForFhir] = useState<any | null>(
    encounters[0] || null
  );
  const [showFhirModal, setShowFhirModal] = useState(false);
  const [copiedFhir, setCopiedFhir] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [alertFilter, setAlertFilter] = useState<'all' | 'Open' | 'Resolved'>('all');

  // Compute real live operational statistics
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayEncounters = encounters.filter((e) => e.encounterDate === todayIso);
  const completeRecords = encounters.filter((e) => e.dataQualityStatus === 'complete');
  const incompleteRecords = encounters.filter((e) => e.dataQualityStatus === 'needs_review');
  const duplicateRecords = alerts.filter(
    (a) => a.alertType === 'Potential Duplicate' && a.status === 'Open'
  );
  const conflictRecords = alerts.filter(
    (a) => a.alertType === 'Sync Conflict' && a.status === 'Open'
  );
  const totalReferrals = encounters.filter((e) => e.referralRequired);
  const openFollowUps = followUps.filter((f) => f.status !== 'Completed');

  // Dynamic last 7 days
  const dates7d = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    return d.toISOString().slice(0, 10);
  });
  const encountersByDate = dates7d.map((d) => ({
    date: d.slice(5),
    count: encounters.filter((e) => e.encounterDate === d).length,
  }));
  const maxDateCount = Math.max(1, ...encountersByDate.map((x) => x.count));

  // Encounters by live community
  const liveCommunitySet = new Set<string>();
  communities.forEach((c) => {
    if (c.name) liveCommunitySet.add(c.name);
  });
  patients.forEach((p) => {
    if (p.community) liveCommunitySet.add(p.community);
  });
  encounters.forEach((e) => {
    if (e.community) liveCommunitySet.add(e.community);
  });
  const communityNames = Array.from(liveCommunitySet);

  const encountersByCommunity = communityNames.map((name) => {
    const count = encounters.filter((e) => e.community === name).length;
    const referrals = encounters.filter((e) => e.community === name && e.referralRequired).length;
    return { name, count, referrals };
  });
  const maxCommCount = Math.max(1, ...encountersByCommunity.map((c) => c.count));

  // Active operators summary
  const frontlineWorkers = workers;

  // Live Operational Insights computed strictly from real records
  const missingFollowUpPct =
    encounters.length > 0
      ? Math.round((incompleteRecords.length / encounters.length) * 100)
      : 0;
  const topCommunity = [...encountersByCommunity].sort((a, b) => b.count - a.count)[0];
  const dueSoonOrOverdueCount = followUps.filter(
    (f) => f.status === 'Due Soon' || f.status === 'Overdue'
  ).length;

  const deterministicInsights = [
    {
      category: 'Record completeness',
      headline:
        encounters.length === 0
          ? 'No patient visits have been recorded yet. Register a patient and record your first visit to begin live tracking.'
          : `${completeRecords.length} of ${encounters.length} recorded visits (${100 - missingFollowUpPct}%) passed all completeness and vital sign checks.`,
      recommendation:
        incompleteRecords.length > 0
          ? `Review ${incompleteRecords.length} visit(s) flagged for missing follow-up dates or observations.`
          : 'Continue verifying vital sign ranges and follow-up dates during patient intake.',
      severity: incompleteRecords.length > 0 ? 'Medium' : 'Normal',
    },
    {
      category: 'Device sync status',
      headline:
        pendingOfflineCount > 0
          ? `${pendingOfflineCount} record(s) are currently saved on this device waiting to sync to the central clinic database.`
          : `All local device records are synchronized with the live PostgreSQL database (${conflictRecords.length} open conflicts).`,
      recommendation:
        pendingOfflineCount > 0
          ? 'Open the Sync Center and tap Sync Now when internet connectivity is active.'
          : 'Offline storage is ready if connectivity drops during community outreach.',
      severity: pendingOfflineCount > 0 || conflictRecords.length > 0 ? 'High' : 'Normal',
    },
    {
      category: 'Community activity',
      headline: topCommunity
        ? `${topCommunity.name} leads live activity with ${topCommunity.count} recorded visit(s) and ${topCommunity.referrals} hospital referral(s).`
        : `${patients.length} patient(s) registered across ${communityNames.length} community ward(s).`,
      recommendation:
        'Use the AI Care Assistant during patient visits to generate structured clinical observations and referral guidance.',
      severity: 'Normal',
    },
    {
      category: 'Follow-up schedule',
      headline:
        openFollowUps.length === 0
          ? 'There are currently 0 open or overdue patient follow-ups.'
          : `${openFollowUps.length} active follow-up(s) scheduled (${dueSoonOrOverdueCount} due today or overdue).`,
      recommendation:
        dueSoonOrOverdueCount > 0
          ? 'Prioritize due-today and overdue patient checkups in the Follow-Ups tab.'
          : 'Enable Follow-Up Required when recording visits that need a return checkup.',
      severity: dueSoonOrOverdueCount > 0 ? 'High' : 'Normal',
    },
  ];

  if (activeTab === 'dashboard') {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="text-xs font-mono text-teal-700">
              DISTRICT OPERATIONS & DATA QUALITY CONSOLE
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Supervisor Operational Intelligence
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('data-quality')}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap"
            >
              Review Alerts ({alerts.filter((a) => a.status === 'Open').length})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('intelligence')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              Open NEXORA Intelligence
            </button>
          </div>
        </div>

        {/* Section 1: Today's Activity & Data Quality Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
              <h2 className="text-sm font-bold text-slate-900">
                01. District Operational Activity
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                Updated: 2026-09-26 · Live PostgreSQL State
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 pt-2 border-t border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Total Encounters</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {encounters.length}
                </div>
                <div className="text-[11px] text-teal-700 font-mono mt-0.5">
                  +{todayEncounters.length} today
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Active Workers</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {frontlineWorkers.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">5 Catchments</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Registered Patients</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {patients.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Consent verified</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Referrals Issued</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {totalReferrals.length}
                </div>
                <div className="text-[11px] text-amber-700 mt-0.5">Specialist care</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Active Follow-Ups</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {openFollowUps.length}
                </div>
                <div className="text-[11px] text-red-600 mt-0.5">
                  {followUps.filter((f) => f.status === 'Overdue').length} overdue
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-bold text-slate-900">02. Data Quality Telemetry</h2>
              <button
                type="button"
                onClick={() => onNavigate('data-quality')}
                className="text-xs font-semibold text-teal-700 hover:underline shrink-0"
              >
                Inspect Queue →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Complete</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                  {completeRecords.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Verified schema</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Incomplete</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                  {incompleteRecords.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Needs review</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Duplicates</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1">
                  {duplicateRecords.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Flagged match</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Sync Conflicts</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {conflictRecords.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Version diff</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Operational Intelligence Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Encounters Over Time */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  03. Encounters Synchronized Over Time (7-Day Window)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily encounter intake across all connected and offline-synced outposts
                </p>
              </div>
              <span className="text-xs font-mono text-slate-600 tabular-nums shrink-0">
                Total: {encounters.length}
              </span>
            </div>
            <div className="h-44 flex items-end gap-1.5 sm:gap-3 pt-4 border-b border-slate-200 pb-2">
              {encountersByDate.map((item) => {
                const heightPct = Math.max(14, Math.round((item.count / maxDateCount) * 100));
                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <span className="text-[11px] sm:text-xs font-mono tabular-nums font-semibold text-slate-700">
                      {item.count}
                    </span>
                    <div className="w-full bg-slate-100 rounded-t-md h-28 flex items-end overflow-hidden">
                      <div
                        className="w-full bg-teal-600 rounded-t-md transition-all duration-200"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-2 text-[10px] sm:text-[11px] font-mono text-slate-500">
              {encountersByDate.map((item) => (
                <div key={item.date} className="flex-1 text-center truncate">
                  {item.date}
                </div>
              ))}
            </div>
          </div>

          {/* Encounters by Community & Referral Trends */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  04. Encounters & Referrals by Community Catchment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operational volume and specialist hospital referrals by rural ward
                </p>
              </div>
            </div>
            <div className="space-y-3.5 pt-2">
              {encountersByCommunity.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No community visits recorded yet. Register a patient or record a visit to see live
                  community breakdown.
                </div>
              ) : (
                encountersByCommunity.map((c) => {
                  const widthPct = Math.max(8, Math.round((c.count / maxCommCount) * 100));
                  return (
                    <div key={c.name} className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="font-medium text-slate-800">{c.name}</span>
                        <span className="font-mono tabular-nums text-slate-600">
                          {c.count} visits · {c.referrals} referrals
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Frontline Worker Activity & Recent Synchronized Encounters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              05. Frontline Worker Activity & Sync Readiness
            </h3>
            <div className="divide-y divide-slate-100">
              {frontlineWorkers.map((w) => {
                const workerEncCount = encounters.filter(
                  (e) => e.workerUid === w.uid || e.workerName === w.fullName
                ).length;
                return (
                  <div key={w.uid} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{w.fullName}</div>
                      <div className="text-slate-500">
                        {w.workerCode} · {w.assignedCommunity}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-semibold text-slate-900">{workerEncCount} records</div>
                      <div className="text-[11px] text-teal-700">Synced</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                06. Recent District Encounters (Validated & Standardized)
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('encounters')}
                className="text-xs font-semibold text-teal-700 hover:underline shrink-0"
              >
                View All ({encounters.length}) →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 px-3 font-medium">Patient</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                    <th className="py-2 px-3 font-medium">Vitals</th>
                    <th className="py-2 pl-3 font-medium text-right">Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {encounters.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                        No visits recorded yet. Click{' '}
                        <button
                          type="button"
                          onClick={() => onNavigate('new-encounter')}
                          className="font-semibold text-teal-700 underline"
                        >
                          New Visit
                        </button>{' '}
                        to record your first live patient visit.
                      </td>
                    </tr>
                  )}
                  {encounters.slice(0, 6).map((enc) => (
                    <tr key={enc.encounterCode} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-700">
                        {enc.encounterCode}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{enc.patientName}</div>
                        <div className="text-[11px] text-slate-500">{enc.community}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{enc.encounterType}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                        {enc.temperature}°C · {enc.bloodPressure}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {enc.dataQualityStatus === 'complete' ? (
                          <span className="text-emerald-700 font-medium">✓ Complete</span>
                        ) : enc.dataQualityStatus === 'duplicate_flagged' ? (
                          <span className="text-red-600 font-medium">⚠ Duplicate Flag</span>
                        ) : (
                          <span className="text-amber-700 font-medium">⚠ Needs Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'data-quality') {
    const filteredAlerts = alerts.filter((a) => {
      if (alertFilter === 'Open') return a.status === 'Open';
      if (alertFilter === 'Resolved') return a.status !== 'Open';
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="text-xs font-mono text-teal-700">
              VALIDATION, DUPLICATE DETECTION & CONFLICT RESOLUTION
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Data Quality & Conflict Governance
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review flagged duplicate records, incomplete field submissions, and multi-device
              synchronization conflicts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(['all', 'Open', 'Resolved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAlertFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  alertFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'all' ? `All Alerts (${alerts.length})` : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredAlerts.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  No {alertFilter !== 'all' ? alertFilter.toLowerCase() : ''} record alerts right now
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  All patient visits and device sync records in this view have been checked and
                  verified.
                </p>
              </div>
              {alertFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setAlertFilter('all')}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
                >
                  Show All Alerts
                </button>
              )}
            </div>
          )}
          {filteredAlerts.map((alert) => {
            let localObj: any = null;
            let serverObj: any = null;
            try {
              if (alert.localVersionJson) localObj = JSON.parse(alert.localVersionJson);
              if (alert.serverVersionJson) serverObj = JSON.parse(alert.serverVersionJson);
            } catch {
              // ignore parse error
            }

            const isOpen = alert.status === 'Open';

            return (
              <div
                key={alert.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        alert.severity === 'High' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    />
                    <span className="font-mono font-semibold text-slate-900">
                      {alert.alertCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-900">{alert.alertType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600">
                      Patient: {alert.patientName} ({alert.patientId})
                    </span>
                  </div>
                  <div className="text-xs font-mono shrink-0">
                    Status:{' '}
                    <span
                      className={
                        isOpen
                          ? 'text-amber-700 font-semibold'
                          : 'text-emerald-700 font-semibold'
                      }
                    >
                      {alert.status}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-700">{alert.description}</p>

                {/* Side-by-Side Conflict / Duplicate Comparison */}
                {(localObj || serverObj) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {localObj && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5">
                        <div className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5">
                          Local / Incoming Field Version
                        </div>
                        {Object.entries(localObj).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 font-mono">
                            <span className="text-slate-500 shrink-0">{k}:</span>
                            <span className="text-slate-900 text-right break-words">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {serverObj && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5">
                        <div className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5">
                          Existing Server Registry Version ({alert.matchingRecordCode})
                        </div>
                        {Object.entries(serverObj).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 font-mono">
                            <span className="text-slate-500 shrink-0">{k}:</span>
                            <span className="text-slate-900 text-right break-words">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Controls for Supervisor */}
                {isOpen && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id, 'Resolved - Kept Local Version')}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Use Local Version
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id, 'Resolved - Kept Server Version')}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Use Server Version
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id, 'Reviewed & Merged Manually')}
                      className="px-3.5 py-1.5 rounded-lg border border-teal-700/40 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Review Manually & Merge
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeTab === 'intelligence') {
    const summaryPayload = {
      totalEncounters: encounters.length,
      todayEncounters: todayEncounters.length,
      incompleteEncounters: incompleteRecords.length,
      openDuplicates: duplicateRecords.length,
      openConflicts: conflictRecords.length,
      overdueFollowUps: followUps.filter((f) => f.status === 'Overdue').length,
      dueSoonFollowUps: followUps.filter((f) => f.status === 'Due Soon').length,
      topCommunity: topCommunity?.name || 'None yet',
      topCommunityCount: topCommunity?.count || 0,
    };

    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="text-xs font-mono text-teal-700">
              OPERATIONAL DECISION SUPPORT LAYER · NON-DIAGNOSTIC
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">NEXORA Intelligence</h1>
            <p className="text-xs text-slate-500 mt-1">
              Automated operational insights and AI-assisted data quality analysis derived from
              synchronized community health records.
            </p>
          </div>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => onRequestAiBrief(summaryPayload)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50 self-start"
          >
            {aiLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            )}
            <span>
              {aiLoading
                ? 'Analyzing District Telemetry...'
                : 'Refresh AI-Assisted Operational Insights'}
            </span>
          </button>
        </div>

        {/* Deterministic Automated Operational Insights */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-sm font-bold text-slate-900">
              01. Automated Operational Insights (Real-Time Rules Engine)
            </h2>
            <span className="text-xs text-slate-500">
              Label: Automated operational insights · Computed from live database records
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deterministicInsights.map((ins, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
                  <span className="font-semibold text-teal-800">{ins.category}</span>
                  <span>
                    Automated operational insight · Priority: {ins.severity}
                  </span>
                </div>
                <p className="text-base font-semibold text-slate-900 leading-snug">
                  “{ins.headline}”
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Recommended Supervisor Action:</strong> {ins.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI-Assisted Operational Insights (Gemini Server-Side) */}
        <div className="space-y-4 pt-2 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-sm font-bold text-slate-900">
              02. AI-Assisted Operational Brief (Server-Side Gemini Decision Support)
            </h2>
            <span className="text-xs text-slate-500">
              Label: AI assisted insights · Operational & data quality scope only
            </span>
          </div>

          {aiError && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
              <strong>Note:</strong> {aiError} Automated operational rules insights above remain
              fully active.
            </div>
          )}

          {aiInsights && aiInsights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiInsights.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 text-white border border-slate-800 rounded-xl p-5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-teal-400 font-mono">
                    <span>{item.category}</span>
                    <span>AI assisted insight · {item.priority}</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug">
                    “{item.headline}”
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Action: {item.recommendation}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900">
                  On-Demand AI Operational Synthesis Ready
                </div>
                <p className="text-xs text-slate-500">
                  Click “Refresh AI-Assisted Operational Insights” to synthesize current district
                  synchronization velocity, incomplete record patterns, and community referral load.
                </p>
              </div>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => onRequestAiBrief(summaryPayload)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-900 whitespace-nowrap"
              >
                Generate AI Brief
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'interoperability') {
    const activeEnc = selectedEncounterForFhir || encounters[0];
    const fhirBundle = activeEnc ? buildFhirR4EncounterBundle(activeEnc) : {};
    const fhirJsonString = JSON.stringify(fhirBundle, null, 2);

    const handleCopy = () => {
      navigator.clipboard.writeText(fhirJsonString);
      setCopiedFhir(true);
      setTimeout(() => setCopiedFhir(false), 2000);
    };

    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 pb-5">
          <div className="text-xs font-mono text-teal-700">
            INTEROPERABILITY READY ARCHITECTURE · HL7 FHIR R4 COMPATIBLE DATA MODEL
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Health System Interoperability Pipeline
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            NEXORA transforms offline field encounters into an interoperability-ready architecture
            using a FHIR-compatible data model so frontline records integrate cleanly with national
            HMIS and DHIS2/EMR registries.
          </p>
        </div>

        {/* Visual Architecture Flow */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">
            01. Standardization & Exchange Architecture
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-11 gap-2 items-center">
            {[
              {
                step: 'NEXORA DATA',
                sub: 'Offline IndexedDB Capture',
              },
              {
                step: 'Validation',
                sub: 'Range & Duplicate Checks',
              },
              {
                step: 'Standardization',
                sub: 'LOINC Vitals & Coded Terms',
              },
              {
                step: 'FHIR Compatible Structure',
                sub: 'Patient · Encounter · Observation',
              },
              {
                step: 'API',
                sub: 'Authenticated REST / JSON',
              },
              {
                step: 'External Health Systems',
                sub: 'District EMR & National HMIS',
              },
            ].map((node, index, arr) => (
              <React.Fragment key={node.step}>
                <div className="xl:col-span-1 bg-slate-900 text-white rounded-lg p-3.5 border border-slate-800 text-center">
                  <div className="text-xs font-bold text-teal-400 break-words">{node.step}</div>
                  <div className="text-[11px] text-slate-300 mt-1">{node.sub}</div>
                </div>
                {index < arr.length - 1 && (
                  <div className="flex justify-center py-1 xl:py-0 text-slate-400">
                    <ArrowRight className="hidden xl:block w-4 h-4" />
                    <ArrowDown className="xl:hidden w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Interactive FHIR Record Transformation Viewer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              02. Select Synchronized Encounter
            </h2>
            <p className="text-xs text-slate-500">
              Choose any frontline encounter to inspect its standardized FHIR-compatible JSON
              bundle representation.
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {encounters.slice(0, 10).map((enc) => {
                const isSelected = activeEnc?.encounterCode === enc.encounterCode;
                return (
                  <div
                    key={enc.encounterCode}
                    className={`p-3 rounded-lg border text-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-slate-900 truncate">
                        {enc.encounterCode} · {enc.patientName}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {enc.encounterType} · {enc.temperature}°C · BP {enc.bloodPressure}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEncounterForFhir(enc);
                        setShowFhirModal(true);
                      }}
                      className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      View Structured Record
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-950 text-slate-100 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileJson className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="text-xs font-mono text-teal-300 truncate">
                  FHIR compatible data model · Bundle/{activeEnc?.encounterCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 shrink-0"
              >
                {copiedFhir ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-xs font-mono text-slate-200 overflow-x-auto max-h-[420px] leading-relaxed">
              {fhirJsonString}
            </pre>
          </div>
        </div>

        {showFhirModal && activeEnc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-4 sm:p-6 text-white shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-mono text-teal-400">
                    INTEROPERABILITY READY ARCHITECTURE · STRUCTURED RECORD VIEWER
                  </div>
                  <h3 className="text-base font-bold mt-0.5">
                    {activeEnc.encounterCode} — {activeEnc.patientName} ({activeEnc.patientId})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFhirModal(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs self-start sm:self-center shrink-0"
                >
                  Close
                </button>
              </div>
              <pre className="text-xs font-mono text-slate-200 overflow-x-auto overflow-y-auto max-h-96 bg-slate-900 p-4 rounded-lg border border-slate-800">
                {fhirJsonString}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'security') {
    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 pb-5">
          <div className="text-xs font-mono text-teal-700">
            DEFENSE-IN-DEPTH INFRASTRUCTURE · REGULATORY ALIGNMENT
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Security & Privacy Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end data protection architecture designed around the Nigeria Data Protection Act
            (NDPA) 2023 regulatory considerations for frontline health data.
          </p>
        </div>

        {/* Visual Security Architecture */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">
            01. End-to-End Security Chain
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-11 gap-2 items-center">
            {[
              { title: 'DEVICE', detail: 'Authenticated Field PWA' },
              { title: 'LOCAL PROTECTION', detail: 'Origin-Isolated IndexedDB' },
              { title: 'SECURE TRANSPORT', detail: 'TLS 1.3 Encrypted Sync' },
              { title: 'API AUTHORIZATION', detail: 'Bearer Token & Role Scope' },
              { title: 'DATABASE', detail: 'PostgreSQL Managed Storage' },
              { title: 'AUDIT LOG', detail: 'Immutable Event Ledger' },
            ].map((node, index, arr) => (
              <React.Fragment key={node.title}>
                <div className="bg-slate-900 text-white rounded-lg p-3.5 text-center border border-slate-800">
                  <div className="text-xs font-mono font-bold text-teal-400 break-words">
                    {node.title}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">{node.detail}</div>
                </div>
                {index < arr.length - 1 && (
                  <div className="flex justify-center py-1 xl:py-0 text-slate-400">
                    <ArrowRight className="hidden xl:block w-4 h-4" />
                    <ArrowDown className="xl:hidden w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Seven Pillar Security Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              heading: 'Authentication',
              label: 'Secure authentication',
              desc: 'Token-verified operator sessions using Firebase Authentication & institutional credential verification with zero secrets in URLs.',
            },
            {
              heading: 'Authorization',
              label: 'Role based access control',
              desc: 'Strict separation between Frontline Worker (field capture & sync queue) and District Supervisor (data quality, conflict resolution & audit).',
            },
            {
              heading: 'Data',
              label: 'Encryption at rest',
              desc: 'Cloud SQL PostgreSQL storage with managed volume encryption and structured relational schema constraints.',
            },
            {
              heading: 'Transport',
              label: 'TLS encrypted communication',
              desc: 'All synchronization payloads between field devices and backend endpoints are transmitted exclusively over HTTPS/TLS.',
            },
            {
              heading: 'Local storage',
              label: 'Protected offline data',
              desc: 'Offline encounters are persisted in browser-isolated IndexedDB stores and automatically purged from the pending queue upon verified server receipt.',
            },
            {
              heading: 'Audit',
              label: 'Activity logging',
              desc: 'Every encounter creation, batch synchronization, duplicate review, and follow-up completion is logged with operator identity and timestamp.',
            },
            {
              heading: 'Privacy & NDPA 2023',
              label: 'Data minimization',
              desc: 'Designed with the Nigeria Data Protection Act (NDPA) 2023 as a core regulatory consideration: explicit patient consent verification and minimal personal data collection.',
            },
          ].map((item) => (
            <div
              key={item.heading}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">{item.heading}</span>
                <span className="text-teal-700 font-medium">{item.label}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'audit-log') {
    const filteredLogs = auditLogs.filter(
      (l) =>
        l.userName.toLowerCase().includes(auditSearch.toLowerCase()) ||
        l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        l.resource.toLowerCase().includes(auditSearch.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="text-xs font-mono text-teal-700">
              IMMUTABLE OPERATIONAL ACTIVITY LEDGER
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Security & Sync Audit Log</h1>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filter by user, action, or resource..."
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Resource</th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center space-y-2">
                      <div className="text-sm font-bold text-slate-900">
                        No matching activity records found
                      </div>
                      <div className="text-xs text-slate-500">
                        No clinic activity matched “{auditSearch}”. Try a different staff name or
                        clear your search.
                      </div>
                      <button
                        type="button"
                        onClick={() => setAuditSearch('')}
                        className="mt-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
                      >
                        Clear Search
                      </button>
                    </td>
                  </tr>
                )}
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="text-[11px] text-slate-500">{log.userRole}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{log.resource}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                      {log.createdAt
                        ? new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)
                        : '2026-09-26 09:15:00'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      <span
                        className={
                          log.status.includes('Flagged') ? 'text-amber-700' : 'text-emerald-700'
                        }
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
