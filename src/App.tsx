import React, { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  LayoutDashboard,
  Users,
  FilePlus2,
  CalendarClock,
  RefreshCw,
  Activity,
  ShieldAlert,
  Sparkles,
  Network,
  ShieldCheck,
  FileText,
  Settings,
  Wifi,
  WifiOff,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  BarChart3,
} from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  OfflineQueueItem,
  getOfflineQueueItems,
  saveOfflineQueueItem,
  updateOfflineQueueItemStatus,
  getMetaValue,
  setMetaValue,
  clearSensitiveOfflineState,
} from './lib/indexedDb.ts';
import {
  validateEncounterForm,
  validatePatientForm,
  ValidationResult,
} from './lib/validation.ts';
import {
  warmUpCriticalApiCaches,
  clearSensitiveApiCaches,
  getServiceWorkerCacheStats,
  ServiceWorkerCacheStats,
} from './lib/serviceWorkerManager.ts';
import { LoginView } from './components/LoginView.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { SiteFooter, WebsitePage } from './components/SiteFooter.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { toFriendlyErrorMessage } from './lib/friendlyErrors.ts';

const SupervisorViews = lazy(() =>
  import('./components/SupervisorViews.tsx').then((m) => ({ default: m.SupervisorViews }))
);

const AICareAssistantView = lazy(() =>
  import('./components/AICareAssistantView.tsx').then((m) => ({
    default: m.AICareAssistantView,
  }))
);

interface UserProfile {
  uid: string;
  username?: string;
  email: string;
  fullName: string;
  role: 'worker' | 'supervisor';
  workerCode: string;
  assignedCommunity: string;
}

interface AiVisitSuggestion {
  suggestedObservations: string;
  suggestedActionTaken: string;
  triagePriority: string;
  referralRecommended: boolean;
  followUpDays: number;
  familyCareTip: string;
}

const AUTH_STORAGE_KEY = 'nexora_live_session_v2';

export default function App() {
  // Live Auth state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [publicPageOverride, setPublicPageOverride] = useState<WebsitePage | null>(null);

  // Real network & offline mode state
  const [manualOfflineMode, setManualOfflineMode] = useState<boolean>(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const isOffline = manualOfflineMode || !browserOnline;

  // Synchronization & IndexedDB Queue State
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncingCount, setSyncingCount] = useState<number>(0);
  const [syncBannerMessage, setSyncBannerMessage] = useState<string | null>(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string>('Connected · Live');

  // Live Server Data
  const [patients, setPatients] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // AI Intelligence & Visit Assistant State
  const [aiInsights, setAiInsights] = useState<any[] | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [visitAiLoading, setVisitAiLoading] = useState<boolean>(false);
  const [visitAiSuggestion, setVisitAiSuggestion] = useState<AiVisitSuggestion | null>(null);
  const [visitAiError, setVisitAiError] = useState<string | null>(null);
  const [swCacheStats, setSwCacheStats] = useState<ServiceWorkerCacheStats | null>(null);

  // Patient Registration Form State (Clean Live Inputs)
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [showNewPatientForm, setShowNewPatientForm] = useState<boolean>(false);
  const [patientForm, setPatientForm] = useState({
    patientId: '',
    fullName: '',
    dateOfBirth: '',
    sex: 'Female',
    phoneNumber: '',
    community: '',
    emergencyContact: '',
    notes: '',
    consentVerified: true,
  });
  const [patientValidation, setPatientValidation] = useState<ValidationResult | null>(null);
  const [patientSaveBanner, setPatientSaveBanner] = useState<string | null>(null);

  // New Visit (Encounter) Form State (Clean Live Inputs)
  const todayIso = new Date().toISOString().slice(0, 10);
  const [encounterForm, setEncounterForm] = useState({
    patientId: '',
    patientName: '',
    community: '',
    encounterDate: todayIso,
    encounterType: 'General Outpatient',
    reasonForVisit: '',
    temperature: '',
    bloodPressure: '',
    heartRate: '',
    respiratoryRate: '',
    symptoms: '',
    observations: '',
    actionTaken: '',
    referralRequired: false,
    referralFacility: '',
    followUpRequired: false,
    followUpDate: '',
    notes: '',
  });
  const [encounterValidation, setEncounterValidation] = useState<ValidationResult | null>(null);
  const [lastSavedEncounterResult, setLastSavedEncounterResult] = useState<{
    storedMode: 'offline_indexeddb' | 'online_postgres';
    validation: ValidationResult;
    summary: string;
  } | null>(null);

  // Follow-up filter state
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');

  // Fetch live data from PostgreSQL backend (or Service Worker API cache when offline)
  const fetchBootstrapData = useCallback(
    async (tokenOverride?: string) => {
      const activeToken = tokenOverride || authToken;
      if (!activeToken) return;

      if (isOffline) {
        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            const apiCache = await caches.open('nexora-critical-api-v2');
            const cachedRes = await apiCache.match('/api/bootstrap');
            if (cachedRes) {
              const cachedData = await cachedRes.json();
              setPatients(cachedData.patients || []);
              setEncounters(cachedData.encounters || []);
              setFollowUps(cachedData.followUps || []);
              setSyncHistory(cachedData.syncQueue || []);
              setAlerts(cachedData.dataQualityAlerts || []);
              setAuditLogs(cachedData.auditLogs || []);
              setWorkers(cachedData.workers || []);
              setCommunities(cachedData.communities || []);
            }
          } catch {
            // Keep current in-memory state
          }
        }
        return;
      }

      setDataLoading(true);
      try {
        const res = await fetch('/api/bootstrap', {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        });
        if (!res.ok) throw new Error('Failed to fetch platform records');
        const data = await res.json();
        setPatients(data.patients || []);
        setEncounters(data.encounters || []);
        setFollowUps(data.followUps || []);
        setSyncHistory(data.syncQueue || []);
        setAlerts(data.dataQualityAlerts || []);
        setAuditLogs(data.auditLogs || []);
        setWorkers(data.workers || []);
        setCommunities(data.communities || []);

        await setMetaValue('cachedBootstrapLive', data);
        await warmUpCriticalApiCaches(activeToken, 'supervisor');
        const stats = await getServiceWorkerCacheStats();
        setSwCacheStats(stats);
      } catch (err) {
        console.warn('Live data fetch warning:', err);
      } finally {
        setDataLoading(false);
      }
    },
    [authToken, isOffline]
  );

  // Restore persisted session and local IndexedDB queue on mount
  useEffect(() => {
    async function initLocalPersistence() {
      const savedQueue = await getOfflineQueueItems();
      setOfflineQueue(savedQueue);
      const savedOffline = await getMetaValue<boolean>('manualOfflineMode', false);
      setManualOfflineMode(savedOffline);
      const savedLastSync = await getMetaValue<string>(
        'lastSyncTimestampLive',
        new Date().toISOString().replace('T', ' ').slice(0, 19)
      );
      setLastSyncTimestamp(savedLastSync);

      const cachedBootstrap = await getMetaValue<any>('cachedBootstrapLive', null);
      if (cachedBootstrap) {
        setPatients(cachedBootstrap.patients || []);
        setEncounters(cachedBootstrap.encounters || []);
        setFollowUps(cachedBootstrap.followUps || []);
        setSyncHistory(cachedBootstrap.syncQueue || []);
        setAlerts(cachedBootstrap.dataQualityAlerts || []);
        setAuditLogs(cachedBootstrap.auditLogs || []);
        setWorkers(cachedBootstrap.workers || []);
        setCommunities(cachedBootstrap.communities || []);
      }

      // Restore authenticated session if previously signed in
      try {
        const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed?.token && parsed?.user) {
            setAuthToken(parsed.token);
            setUser(parsed.user);
            fetchBootstrapData(parsed.token);
          }
        }
      } catch {
        // Ignore storage read errors
      }

      const stats = await getServiceWorkerCacheStats();
      setSwCacheStats(stats);
    }
    initLocalPersistence();

    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchBootstrapData]);

  const toggleOfflineMode = async (nextState?: boolean) => {
    const target = typeof nextState === 'boolean' ? nextState : !manualOfflineMode;
    setManualOfflineMode(target);
    await setMetaValue('manualOfflineMode', target);
    if (!target) {
      setSyncBannerMessage(
        'Connection restored. Any visits or patients saved on your device are ready to sync.'
      );
    } else {
      setSyncBannerMessage(null);
    }
  };

  // Live Username & Password Login Handler
  const handleLogin = async (usernameInput: string, passwordInput: string) => {
    setAuthLoading(true);
    setAuthError(null);
    const cleanUser = usernameInput.trim();
    const cleanPass = passwordInput.trim();

    if (isOffline) {
      if (cleanUser.toLowerCase() === 'daniel_idah' && cleanPass === '@Best2026_') {
        const offlineUser: UserProfile = {
          uid: 'user-daniel-idah',
          username: 'daniel_idah',
          email: 'daniel_idah@nexora.health',
          role: 'supervisor',
          fullName: 'Daniel Idah',
          workerCode: 'OP-001',
          assignedCommunity: 'Primary Health Network',
        };
        const offlineToken = 'nexora-live-session-daniel-idah';
        setAuthToken(offlineToken);
        setUser(offlineUser);
        try {
          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({ token: offlineToken, user: offlineUser })
          );
        } catch {
          // Ignore storage errors
        }
        setPublicPageOverride(null);
        setActiveTab('dashboard');
        setAuthLoading(false);
        return;
      }
      setAuthError('Invalid username or password. Please check your credentials and try again.');
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }
      setAuthToken(data.token);
      setUser(data.user);
      try {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ token: data.token, user: data.user })
        );
      } catch {
        // Ignore storage errors
      }
      setPublicPageOverride(null);
      setActiveTab('dashboard');
      await fetchBootstrapData(data.token);
    } catch (err: any) {
      setAuthError(toFriendlyErrorMessage(err, 'login'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Google Sign-In handler
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify Google session');
      setAuthToken(idToken);
      setUser(data.user);
      try {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ token: idToken, user: data.user })
        );
      } catch {
        // Ignore storage errors
      }
      setPublicPageOverride(null);
      setActiveTab('dashboard');
      await fetchBootstrapData(idToken);
    } catch (err: any) {
      setAuthError(toFriendlyErrorMessage(err, 'google'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Save Patient (Online to PostgreSQL or Offline to IndexedDB)
  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePatientForm(patientForm, patients);
    setPatientValidation(validation);
    if (!validation.isValidToSave) return;

    const generatedId =
      patientForm.patientId.trim() ||
      `NXR-PT-${1001 + patients.length + offlineQueue.length}`;
    const cleanCommunity = patientForm.community.trim() || 'General Clinic Ward';
    const payload = {
      ...patientForm,
      patientId: generatedId,
      community: cleanCommunity,
    };

    if (isOffline) {
      const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const queueItem: OfflineQueueItem = {
        queueId: `LOCAL-PT-${Date.now()}`,
        recordType: 'patient',
        patientId: generatedId,
        patientName: payload.fullName,
        community: payload.community,
        summary: `New Patient Registration · ${payload.fullName} (${payload.community})`,
        payload,
        validationStatus: validation.qualityStatus,
        validationWarnings: validation.reviewWarnings,
        duplicateMatchCode: validation.duplicateCandidate?.code,
        createdTime: nowTime,
        status: 'Pending',
      };
      await saveOfflineQueueItem(queueItem);
      const updatedQueue = await getOfflineQueueItems();
      setOfflineQueue(updatedQueue);
      setPatients((prev) => [{ ...payload, syncStatus: 'pending_offline' }, ...prev]);
      setEncounterForm((prev) => ({
        ...prev,
        patientId: generatedId,
        patientName: payload.fullName,
        community: payload.community,
      }));
      setPatientSaveBanner(
        `Patient ${generatedId} (${payload.fullName}) saved on this device and queued to sync.`
      );
      setPatientForm({
        patientId: '',
        fullName: '',
        dateOfBirth: '',
        sex: 'Female',
        phoneNumber: '',
        community: '',
        emergencyContact: '',
        notes: '',
        consentVerified: true,
      });
      setShowNewPatientForm(false);
    } else {
      try {
        const res = await fetch('/api/patients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to save patient online');
        await fetchBootstrapData();
        setEncounterForm((prev) => ({
          ...prev,
          patientId: generatedId,
          patientName: payload.fullName,
          community: payload.community,
        }));
        setPatientSaveBanner(
          `Patient ${generatedId} (${payload.fullName}) registered and saved to the live clinic database.`
        );
        setPatientForm({
          patientId: '',
          fullName: '',
          dateOfBirth: '',
          sex: 'Female',
          phoneNumber: '',
          community: '',
          emergencyContact: '',
          notes: '',
          consentVerified: true,
        });
        setShowNewPatientForm(false);
      } catch (err: any) {
        setPatientSaveBanner(toFriendlyErrorMessage(err, 'save'));
      }
    }
  };

  // AI Visit Assistant: Generates observations, care actions, and follow-up guidance for the current visit form
  const handleAskVisitAi = async () => {
    if (!encounterForm.reasonForVisit.trim() && !encounterForm.symptoms.trim()) {
      setVisitAiError('Please enter a Reason for Visit or Symptoms first so the AI can assist.');
      return;
    }
    setVisitAiLoading(true);
    setVisitAiError(null);
    try {
      const res = await fetch('/api/ai/visit-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(encounterForm),
      });
      const data = await res.json();
      if (!res.ok || !data.suggestion) {
        throw new Error(data.error || 'AI visit assistant unavailable');
      }
      setVisitAiSuggestion(data.suggestion);
    } catch (err) {
      setVisitAiError(toFriendlyErrorMessage(err, 'ai'));
    } finally {
      setVisitAiLoading(false);
    }
  };

  const applyAiVisitSuggestion = (suggestion: AiVisitSuggestion) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (suggestion.followUpDays || 7));
    const followUpIso = nextDate.toISOString().slice(0, 10);

    setEncounterForm((prev) => ({
      ...prev,
      observations: suggestion.suggestedObservations || prev.observations,
      actionTaken: suggestion.suggestedActionTaken || prev.actionTaken,
      referralRequired: Boolean(suggestion.referralRecommended),
      followUpRequired: true,
      followUpDate: prev.followUpDate || followUpIso,
      notes: prev.notes || `Family Care Tip: ${suggestion.familyCareTip}`,
    }));
  };

  // Save Encounter (Online to PostgreSQL or Offline to IndexedDB)
  const handleSaveEncounter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effectivePatientId =
      encounterForm.patientId.trim() || `NXR-PT-${1001 + patients.length}`;
    const effectivePatientName = encounterForm.patientName.trim();
    const effectiveCommunity = encounterForm.community.trim() || 'General Clinic Ward';

    const targetForm = {
      ...encounterForm,
      patientId: effectivePatientId,
      patientName: effectivePatientName,
      community: effectiveCommunity,
    };

    const validation = validateEncounterForm(targetForm, encounters);
    setEncounterValidation(validation);

    if (!validation.isValidToSave) {
      setLastSavedEncounterResult(null);
      return;
    }

    const clientRecordId = `client-enc-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    const payload = {
      ...targetForm,
      clientRecordId,
      capturedOffline: isOffline,
    };

    if (isOffline) {
      const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const queueItem: OfflineQueueItem = {
        queueId: `LOCAL-ENC-${Date.now()}-${Math.floor(Math.random() * 99)}`,
        recordType: 'encounter',
        patientId: targetForm.patientId,
        patientName: targetForm.patientName,
        community: targetForm.community,
        summary: `${targetForm.encounterType} · ${targetForm.patientName} (BP ${targetForm.bloodPressure}, ${targetForm.temperature}°C)`,
        payload,
        validationStatus: validation.qualityStatus,
        validationWarnings: validation.reviewWarnings,
        duplicateMatchCode: validation.duplicateCandidate?.code,
        createdTime: nowTime,
        status: 'Pending',
      };
      await saveOfflineQueueItem(queueItem);
      const updatedQueue = await getOfflineQueueItems();
      setOfflineQueue(updatedQueue);

      setLastSavedEncounterResult({
        storedMode: 'offline_indexeddb',
        validation,
        summary: `${targetForm.patientName} (${targetForm.patientId}) — ${targetForm.encounterType}`,
      });
      setVisitAiSuggestion(null);
    } else {
      try {
        const res = await fetch('/api/encounters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to save encounter to server');
        await fetchBootstrapData();
        setLastSavedEncounterResult({
          storedMode: 'online_postgres',
          validation,
          summary: `${targetForm.patientName} (${targetForm.patientId}) — ${targetForm.encounterType}`,
        });
        setVisitAiSuggestion(null);
      } catch (err: any) {
        setSyncBannerMessage(toFriendlyErrorMessage(err, 'save'));
      }
    }
  };

  // Trigger Synchronization of Pending IndexedDB Records
  const handleSyncNow = async () => {
    if (isOffline) {
      setSyncBannerMessage(
        'Cannot sync while Offline Mode is active. Switch to Online Mode first to send your saved records.'
      );
      return;
    }

    const pendingItems = offlineQueue.filter((item) => item.status === 'Pending');
    if (pendingItems.length === 0) {
      setSyncBannerMessage('All local device records are already synced with the clinic server.');
      return;
    }

    setIsSyncing(true);
    setSyncingCount(pendingItems.length);
    setSyncBannerMessage(`Sending ${pendingItems.length} saved record(s) to the clinic server...`);

    try {
      for (const item of pendingItems) {
        await updateOfflineQueueItemStatus(item.queueId, 'Synchronizing');
      }
      setOfflineQueue(await getOfflineQueueItems());

      await new Promise((r) => setTimeout(r, 600));

      const res = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          items: pendingItems.map((i) => ({
            queueId: i.queueId,
            recordType: i.recordType,
            payload: i.payload,
          })),
        }),
      });

      if (!res.ok) throw new Error('Batch synchronization failed');
      const syncData = await res.json();
      const syncedNow = new Date().toISOString().replace('T', ' ').slice(0, 19);

      for (const item of pendingItems) {
        await updateOfflineQueueItemStatus(item.queueId, 'Synchronized', syncedNow);
      }

      const refreshedLocalQueue = await getOfflineQueueItems();
      setOfflineQueue(refreshedLocalQueue);
      setLastSyncTimestamp(syncedNow);
      await setMetaValue('lastSyncTimestampLive', syncedNow);

      await fetchBootstrapData();
      setSyncBannerMessage(
        `${syncData.syncedCount} record(s) synced and verified in the live clinic database.`
      );
    } catch (err: any) {
      for (const item of pendingItems) {
        await updateOfflineQueueItemStatus(item.queueId, 'Failed');
      }
      setOfflineQueue(await getOfflineQueueItems());
      setSyncBannerMessage(toFriendlyErrorMessage(err, 'sync'));
    } finally {
      setIsSyncing(false);
      setSyncingCount(0);
    }
  };

  // Complete a Follow-Up Case
  const handleCompleteFollowUp = async (followUpId: number) => {
    if (isOffline) {
      setFollowUps((prev) =>
        prev.map((f) => (f.id === followUpId ? { ...f, status: 'Completed' } : f))
      );
      return;
    }
    try {
      const res = await fetch(`/api/follow-ups/${followUpId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          outcomeNotes: 'Completed follow-up check and verified patient stability.',
        }),
      });
      if (res.ok) {
        await fetchBootstrapData();
      }
    } catch (err) {
      console.warn('Complete follow-up warning:', err);
    }
  };

  // Resolve a Data Quality or Sync Conflict Alert
  const handleResolveAlert = async (alertId: number, resolutionStatus: string) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ resolutionStatus }),
      });
      if (res.ok) {
        await fetchBootstrapData();
      }
    } catch (err) {
      console.warn('Resolve alert warning:', err);
    }
  };

  // Request AI Operational Brief from Server-Side Gemini
  const handleRequestAiBrief = async (summaryMetrics: any) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/intelligence/ai-brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ summaryMetrics }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gemini API call failed');
      }
      setAiInsights(data.insights || []);
    } catch (err: any) {
      setAiError(toFriendlyErrorMessage(err, 'ai'));
    } finally {
      setAiLoading(false);
    }
  };

  // Render Main Website / Login View if unauthenticated or if user is browsing the public website
  if (!user || !authToken || publicPageOverride) {
    return (
      <ErrorBoundary>
        <LoginView
          onLogin={handleLogin}
          onGoogleLogin={handleGoogleLogin}
          error={authError}
          loading={authLoading}
          isAuthenticated={Boolean(user && authToken)}
          onReturnToWorkspace={() => setPublicPageOverride(null)}
          initialPage={publicPageOverride || 'home'}
        />
      </ErrorBoundary>
    );
  }

  // Derived Live Counts
  const pendingOfflineItems = offlineQueue.filter((i) => i.status === 'Pending');
  const synchronizingItems = offlineQueue.filter((i) => i.status === 'Synchronizing');
  const localSyncedItems = offlineQueue.filter((i) => i.status === 'Synchronized');
  const failedItems = offlineQueue.filter((i) => i.status === 'Failed');

  const todayEncountersCount =
    encounters.filter((e) => e.encounterDate === todayIso).length +
    pendingOfflineItems.filter((i) => i.recordType === 'encounter').length;

  const dueFollowUpsCount = followUps.filter(
    (f) => f.status === 'Due Soon' || f.status === 'Overdue'
  ).length;

  const openAlertsCount = alerts.filter((a) => a.status === 'Open').length;

  // Unified Live Navigation Menu
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: `Patients (${patients.length})`, icon: Users },
    { id: 'new-encounter', label: 'New Health Visit', icon: FilePlus2 },
    { id: 'ai-assistant', label: 'AI Care Assistant', icon: Sparkles },
    { id: 'follow-ups', label: `Follow-Ups (${dueFollowUpsCount})`, icon: CalendarClock },
    {
      id: 'sync-center',
      label: `Sync Center (${pendingOfflineItems.length})`,
      icon: RefreshCw,
    },
    { id: 'encounters', label: `All Visits (${encounters.length})`, icon: FileText },
    { id: 'clinic-overview', label: 'Clinic Analytics', icon: BarChart3 },
    { id: 'data-quality', label: `Record Quality (${openAlertsCount})`, icon: ShieldAlert },
    { id: 'intelligence', label: 'AI Clinic Brief', icon: Sparkles },
    { id: 'interoperability', label: 'Record Sharing (FHIR)', icon: Network },
    { id: 'security', label: 'Security & Privacy', icon: ShieldCheck },
    { id: 'audit-log', label: 'Activity Log', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Persistent Offline Mode Active Banner */}
      {isOffline && (
        <div className="bg-amber-600 text-white px-4 py-2.5 border-b border-amber-700">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <div className="flex items-start sm:items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>Offline Mode Active:</strong> Your patient registrations and visits are
                being safely saved on this device and will sync when internet returns.
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
              <span className="font-mono">
                Waiting to Sync: {pendingOfflineItems.length} record(s)
              </span>
              {manualOfflineMode && (
                <button
                  type="button"
                  onClick={() => toggleOfflineMode(false)}
                  className="px-2.5 py-1 rounded bg-white text-amber-900 font-semibold hover:bg-amber-50 transition-colors whitespace-nowrap"
                >
                  Reconnect Online
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout: Sidebar + Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 bg-slate-950 text-slate-200 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 shrink-0">
          <div>
            {/* Brand Header */}
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-teal-950 border border-teal-700/60 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 64 64" fill="none">
                    <path
                      d="M26 12H38V26H52V38H38V52H26V38H12V26H26V12Z"
                      stroke="#14B8A6"
                      strokeWidth="4"
                    />
                    <circle cx="32" cy="32" r="5" fill="#F8FAFC" />
                  </svg>
                </div>
                <span className="font-bold tracking-tight text-white text-base truncate font-display">
                  NEXORA Health
                </span>
              </div>
              <span className="lg:hidden text-[11px] font-mono text-teal-400 shrink-0">
                {user.username || 'daniel_idah'}
              </span>
            </div>

            {/* Authenticated Operator Profile */}
            <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/50">
              <div className="text-xs font-semibold text-white truncate">{user.fullName}</div>
              <div className="text-[11px] text-teal-400 font-mono truncate mt-0.5">
                @{user.username || 'daniel_idah'} · {user.workerCode}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {user.assignedCommunity}
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-2.5 sm:p-3 flex lg:flex-col gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : ''}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Bottom Controls: PWA Install + Main Website + Sign Out */}
          <div className="p-3 sm:p-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setPublicPageOverride('home')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
            >
              <span>Main Website</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUser(null);
                setAuthToken(null);
                setPublicPageOverride(null);
                try {
                  localStorage.removeItem(AUTH_STORAGE_KEY);
                } catch {
                  // Ignore storage errors
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Right Main Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Operational Header with Connectivity Indicator & Offline Working Mode Toggle */}
          <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                Live Clinic Workspace ({user.fullName})
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Last Sync: {lastSyncTimestamp}</span>
              {dataLoading && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-teal-700 font-mono">Updating...</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 shrink-0">
                {isOffline ? (
                  <>
                    <span aria-hidden="true">🔴</span>
                    <span className="text-red-700">Offline Mode</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">🟢</span>
                    <span className="text-emerald-700">Online &amp; Connected</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => toggleOfflineMode()}
                className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  manualOfflineMode
                    ? 'bg-amber-600 border-amber-700 text-white hover:bg-amber-700'
                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {manualOfflineMode ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 shrink-0" />
                    <span>Work Online (Reconnect)</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Work Offline</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Synchronization Status Notification Banner */}
          {syncBannerMessage && (
            <div className="bg-teal-950 text-teal-100 px-4 sm:px-6 py-2.5 border-b border-teal-800 flex items-start sm:items-center justify-between gap-3 sm:gap-4 text-xs">
              <div className="flex items-start sm:items-center gap-2">
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-400 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5 sm:mt-0" />
                )}
                <span>{syncBannerMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncBannerMessage(null)}
                className="text-teal-300 hover:text-white text-xs font-mono shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main Content Container */}
          <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto min-w-0 animate-fade-in">
            <ErrorBoundary>
              {/* AI CARE ASSISTANT VIEW */}
              {activeTab === 'ai-assistant' && (
                <Suspense
                  fallback={
                    <div className="space-y-4 py-6">
                      <div className="h-8 w-64 rounded-lg bg-slate-200 animate-pulse" />
                      <div className="h-36 rounded-xl bg-slate-200/70 animate-pulse" />
                    </div>
                  }
                >
                  <AICareAssistantView
                    authToken={authToken}
                    patients={patients}
                    encounters={encounters}
                    followUps={followUps}
                    alerts={alerts}
                    onNavigate={setActiveTab}
                  />
                </Suspense>
              )}

              {/* CLINIC ANALYTICS, RECORD QUALITY, AI BRIEF, INTEROPERABILITY, SECURITY, AUDIT LOG */}
              {[
                'clinic-overview',
                'data-quality',
                'intelligence',
                'interoperability',
                'security',
                'audit-log',
              ].includes(activeTab) && (
                <Suspense
                  fallback={
                    <div className="space-y-4 py-6">
                      <div className="h-8 w-64 rounded-lg bg-slate-200 animate-pulse" />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="h-28 rounded-xl bg-slate-200/70 animate-pulse" />
                        <div className="h-28 rounded-xl bg-slate-200/70 animate-pulse" />
                        <div className="h-28 rounded-xl bg-slate-200/70 animate-pulse" />
                      </div>
                      <div className="h-64 rounded-xl bg-slate-200/60 animate-pulse" />
                    </div>
                  }
                >
                  <SupervisorViews
                    activeTab={activeTab === 'clinic-overview' ? 'dashboard' : activeTab}
                    encounters={encounters}
                    patients={patients}
                    workers={workers}
                    communities={communities}
                    followUps={followUps}
                    alerts={alerts}
                    auditLogs={auditLogs}
                    pendingOfflineCount={pendingOfflineItems.length}
                    onResolveAlert={handleResolveAlert}
                    onNavigate={setActiveTab}
                    onRequestAiBrief={handleRequestAiBrief}
                    aiInsights={aiInsights}
                    aiLoading={aiLoading}
                    aiError={aiError}
                  />
                </Suspense>
              )}

              {/* MAIN UNIFIED DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <div className="text-xs font-semibold text-teal-700">
                        Live Clinic Dashboard · {user.assignedCommunity}
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 mt-1">
                        Welcome, {user.fullName}
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Status: {isOffline ? '🔴 Offline (Saving to Device)' : '🟢 Connected to Live Database'} · Last sync: {lastSyncTimestamp}
                      </p>
                    </div>

                    {/* Primary Action Buttons */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewPatientForm(true);
                          setActiveTab('patients');
                        }}
                        className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap text-center"
                      >
                        + Register Patient
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLastSavedEncounterResult(null);
                          setActiveTab('new-encounter');
                        }}
                        className="px-3.5 sm:px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap text-center"
                      >
                        + New Health Visit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ai-assistant')}
                        className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap text-center flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                        <span>AI Assistant</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('sync-center');
                          if (!isOffline && pendingOfflineItems.length > 0) {
                            handleSyncNow();
                          }
                        }}
                        className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap text-center"
                      >
                        Sync ({pendingOfflineItems.length})
                      </button>
                    </div>
                  </div>

                  {/* 4 Key Live Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500">Registered patients</div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                        {patients.length}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Active in live clinic registry
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500">Today&apos;s visits</div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                        {todayEncountersCount}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Total recorded visits: {encounters.length}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500">Waiting to sync</div>
                      <div
                        className={`text-3xl font-bold font-mono tabular-nums mt-1 ${
                          pendingOfflineItems.length > 0 ? 'text-amber-600' : 'text-emerald-700'
                        }`}
                      >
                        {pendingOfflineItems.length}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {pendingOfflineItems.length > 0
                          ? 'Saved on this device'
                          : 'All device records synced'}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500">Follow-ups due</div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                        {dueFollowUpsCount}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Due today or overdue checkups
                      </div>
                    </div>
                  </div>

                  {/* Summarized 'Pending Action' List Prioritizing Local Synchronization Queue */}
                  <div
                    className={`rounded-xl border p-4 sm:p-5 space-y-4 ${
                      isOffline || pendingOfflineItems.length > 0
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-semibold text-teal-800">
                          <span>Priority Action Queue</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {isOffline
                              ? 'Offline Mode: Local Queue Prioritized'
                              : 'Online & Ready to Sync'}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mt-0.5">
                          Pending Action List ({pendingOfflineItems.length} Waiting to Sync ·{' '}
                          {dueFollowUpsCount} Follow-Ups Due)
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Items waiting in your device sync queue are prioritized first so you know
                          exactly what will send next when connected.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {pendingOfflineItems.length > 0 && isOffline && manualOfflineMode && (
                          <button
                            type="button"
                            onClick={() => toggleOfflineMode(false)}
                            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            Reconnect to Sync ({pendingOfflineItems.length})
                          </button>
                        )}
                        {pendingOfflineItems.length > 0 && !isOffline && (
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={handleSyncNow}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>Sync Queue Now ({pendingOfflineItems.length})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab('sync-center')}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          Open Sync Center →
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200/70 text-xs">
                      {/* Priority Tier 1: Local Synchronization Queue Items */}
                      {[...pendingOfflineItems]
                        .sort((a, b) => {
                          const aUrgent =
                            a.payload?.referralRequired || a.validationStatus !== 'complete'
                              ? 1
                              : 0;
                          const bUrgent =
                            b.payload?.referralRequired || b.validationStatus !== 'complete'
                              ? 1
                              : 0;
                          if (bUrgent !== aUrgent) return bUrgent - aUrgent;
                          return a.createdTime.localeCompare(b.createdTime);
                        })
                        .map((item, idx) => (
                          <div
                            key={item.queueId}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-amber-800">
                                  #{idx + 1} NEXT TO SYNC
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono font-semibold text-slate-900">
                                  {item.patientId}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-900">
                                  {item.patientName}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-600 capitalize">
                                  {item.recordType === 'encounter'
                                    ? item.payload?.encounterType || 'Health Visit'
                                    : 'Patient Registration'}
                                </span>
                              </div>
                              <div className="text-slate-600">
                                {item.summary} ·{' '}
                                <span className="font-mono text-slate-500">
                                  Saved {item.createdTime}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
                              <span
                                className={`font-mono font-semibold ${
                                  item.validationStatus === 'complete'
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {item.validationStatus === 'complete'
                                  ? '✓ Ready to Sync'
                                  : '⚠ Needs Review on Sync'}
                              </span>

                              {isOffline ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('sync-center')}
                                  className="px-3 py-1.5 rounded-lg border border-amber-400 bg-white hover:bg-amber-50 text-amber-900 font-semibold whitespace-nowrap"
                                >
                                  Saved Offline
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleSyncNow}
                                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold whitespace-nowrap"
                                >
                                  Sync Now
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                      {/* Empty Queue State */}
                      {pendingOfflineItems.length === 0 && (
                        <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {isOffline
                                ? 'Priority 1 · Device Queue Ready for Offline Visits'
                                : 'Priority 1 · Device Sync Queue Clear (0 Pending)'}
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              {isOffline
                                ? 'You are working offline. Any new patients or health visits you save will appear here at the top of your Pending Action list.'
                                : 'All locally recorded visits and patient registrations are synced with the live database.'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setLastSavedEncounterResult(null);
                              setActiveTab('new-encounter');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold whitespace-nowrap self-start sm:self-center"
                          >
                            + Record Health Visit
                          </button>
                        </div>
                      )}

                      {/* Priority Tier 2: Due Today & Overdue Follow-Ups */}
                      {followUps
                        .filter((f) => f.status === 'Overdue' || f.status === 'Due Soon')
                        .slice(0, 5)
                        .map((fup) => (
                          <div
                            key={fup.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`font-mono font-semibold ${
                                    fup.status === 'Overdue' ? 'text-red-600' : 'text-teal-700'
                                  }`}
                                >
                                  {fup.status === 'Overdue'
                                    ? 'FOLLOW-UP OVERDUE'
                                    : 'FOLLOW-UP DUE TODAY'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono font-semibold text-slate-900">
                                  {fup.patientId}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-900">
                                  {fup.patientName}
                                </span>
                              </div>
                              <div className="text-slate-600">
                                {fup.reason} · <span className="font-mono">Due {fup.dueDate}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCompleteFollowUp(fup.id)}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold whitespace-nowrap"
                              >
                                Mark Completed
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Recent Health Visits Table */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <h2 className="text-sm font-bold text-slate-900">Recent Health Visits</h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('new-encounter')}
                        className="text-xs font-semibold text-teal-700 hover:underline shrink-0"
                      >
                        + Record New Visit
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2.5 pr-3 font-semibold">Visit ID</th>
                            <th className="py-2.5 px-3 font-semibold">Patient</th>
                            <th className="py-2.5 px-3 font-semibold">Visit Type</th>
                            <th className="py-2.5 px-3 font-semibold">Vitals</th>
                            <th className="py-2.5 px-3 font-semibold">Quality</th>
                            <th className="py-2.5 pl-3 font-semibold text-right">Sync Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pendingOfflineItems.filter((i) => i.recordType === 'encounter')
                            .length === 0 &&
                            encounters.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-10 px-4 text-center space-y-2.5">
                                  <div className="text-sm font-bold text-slate-900">
                                    No health visits recorded yet
                                  </div>
                                  <div className="text-xs text-slate-500 max-w-md mx-auto">
                                    Start by registering a patient or recording your first live
                                    health visit with AI assistance.
                                  </div>
                                  <div className="flex items-center justify-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowNewPatientForm(true);
                                        setActiveTab('patients');
                                      }}
                                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
                                    >
                                      + Register Patient
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('new-encounter')}
                                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                                    >
                                      + Record First Visit
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          {pendingOfflineItems
                            .filter((i) => i.recordType === 'encounter')
                            .map((item) => (
                              <tr key={item.queueId} className="bg-amber-50/40">
                                <td className="py-3 pr-3 font-mono tabular-nums text-amber-800">
                                  {item.queueId}
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-900">
                                  {item.patientName} ({item.patientId})
                                </td>
                                <td className="py-3 px-3 text-slate-700">
                                  {item.payload.encounterType}
                                </td>
                                <td className="py-3 px-3 font-mono tabular-nums text-slate-600">
                                  {item.payload.temperature}°C · {item.payload.bloodPressure}
                                </td>
                                <td className="py-3 px-3">
                                  {item.validationStatus === 'complete' ? (
                                    <span className="text-emerald-700 font-medium">✓ Complete</span>
                                  ) : (
                                    <span className="text-amber-700 font-medium">
                                      ⚠ Needs Review
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 pl-3 text-right font-mono text-amber-700 font-semibold">
                                  Waiting to Sync
                                </td>
                              </tr>
                            ))}
                          {encounters.slice(0, 10).map((enc) => (
                            <tr key={enc.encounterCode} className="hover:bg-slate-50">
                              <td className="py-3 pr-3 font-mono tabular-nums text-slate-700">
                                {enc.encounterCode}
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-900">
                                {enc.patientName} ({enc.patientId})
                              </td>
                              <td className="py-3 px-3 text-slate-700">{enc.encounterType}</td>
                              <td className="py-3 px-3 font-mono tabular-nums text-slate-600">
                                {enc.temperature}°C · {enc.bloodPressure}
                              </td>
                              <td className="py-3 px-3">
                                {enc.dataQualityStatus === 'complete' ? (
                                  <span className="text-emerald-700 font-medium">✓ Complete</span>
                                ) : enc.dataQualityStatus === 'duplicate_flagged' ? (
                                  <span className="text-red-600 font-medium">
                                    ⚠ Potential Duplicate
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-medium">⚠ Needs Review</span>
                                )}
                              </td>
                              <td className="py-3 pl-3 text-right font-mono text-emerald-700">
                                Synced
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PATIENTS REGISTRY & REGISTRATION FORM */}
              {activeTab === 'patients' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <div className="text-xs font-semibold text-teal-700">
                        Live Patient Registry · Privacy &amp; Consent Protected
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 mt-1">
                        Registered Patients ({patients.length})
                      </h1>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Search name, ID, community..."
                          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewPatientForm(!showNewPatientForm);
                          setPatientValidation(null);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>{showNewPatientForm ? 'Close Form' : 'Register Patient'}</span>
                      </button>
                    </div>
                  </div>

                  {patientSaveBanner && (
                    <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-xs text-teal-900 flex items-start sm:items-center justify-between gap-3">
                      <span>{patientSaveBanner}</span>
                      <button
                        type="button"
                        onClick={() => setPatientSaveBanner(null)}
                        className="font-semibold underline shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {showNewPatientForm && (
                    <form
                      onSubmit={handleSavePatient}
                      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5"
                    >
                      <div className="border-b border-slate-100 pb-3">
                        <h2 className="text-base font-bold text-slate-900">
                          New Patient Registration
                        </h2>
                        <p className="text-xs text-slate-500">
                          Leave Patient ID blank to auto-generate a unique clinic ID. Patient age in
                          years is calculated automatically from Date of Birth.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Patient ID (Auto-generated if blank)
                          </label>
                          <input
                            type="text"
                            value={patientForm.patientId}
                            onChange={(e) =>
                              setPatientForm({ ...patientForm, patientId: e.target.value })
                            }
                            placeholder="Auto-generated (e.g. NXR-PT-1001)"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={patientForm.fullName}
                            onChange={(e) =>
                              setPatientForm({ ...patientForm, fullName: e.target.value })
                            }
                            placeholder="Enter patient's full name"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-semibold text-slate-700">
                              Date of Birth *
                            </label>
                            <span className="font-mono tabular-nums text-[11px] font-semibold text-teal-700">
                              {(() => {
                                if (!patientForm.dateOfBirth) return 'Select DOB';
                                const dob = new Date(patientForm.dateOfBirth);
                                const refDate = new Date();
                                if (isNaN(dob.getTime()) || dob > refDate) return 'Invalid DOB';
                                let age = refDate.getFullYear() - dob.getFullYear();
                                const m = refDate.getMonth() - dob.getMonth();
                                if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) {
                                  age--;
                                }
                                return `${age} ${age === 1 ? 'yr' : 'yrs'} old`;
                              })()}
                            </span>
                          </div>
                          <input
                            type="date"
                            required
                            value={patientForm.dateOfBirth}
                            onChange={(e) =>
                              setPatientForm({ ...patientForm, dateOfBirth: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Calculated Age (Years)
                          </label>
                          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono tabular-nums text-slate-900 flex items-center justify-between">
                            {(() => {
                              if (!patientForm.dateOfBirth) {
                                return <span className="text-slate-400">Select DOB above</span>;
                              }
                              const dob = new Date(patientForm.dateOfBirth);
                              const refDate = new Date();
                              if (isNaN(dob.getTime()) || dob > refDate) {
                                return (
                                  <span className="text-red-600 font-semibold">
                                    Invalid future date
                                  </span>
                                );
                              }
                              let age = refDate.getFullYear() - dob.getFullYear();
                              const m = refDate.getMonth() - dob.getMonth();
                              if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) {
                                age--;
                              }
                              const cohort =
                                age < 1
                                  ? 'Infant (<1 yr)'
                                  : age < 5
                                    ? 'Child Under-5'
                                    : age < 18
                                      ? 'Youth'
                                      : 'Adult';
                              return (
                                <>
                                  <span className="font-semibold">
                                    {age} {age === 1 ? 'year' : 'years'}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-sans">
                                    {cohort}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Sex *</label>
                          <select
                            value={patientForm.sex}
                            onChange={(e) =>
                              setPatientForm({ ...patientForm, sex: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={patientForm.phoneNumber}
                            onChange={(e) =>
                              setPatientForm({ ...patientForm, phoneNumber: e.target.value })
                            }
                            placeholder="+234 800 000 0000"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Community / Ward *
                          </label>
                          <input
                            type="text"
                            required
                            value={patientForm.community}
                            onChange={(e) =>
                              setPatientForm({ ...patientForm, community: e.target.value })
                            }
                            placeholder="Enter community or ward name"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Emergency Contact
                          </label>
                          <input
                            type="text"
                            value={patientForm.emergencyContact}
                            onChange={(e) =>
                              setPatientForm({
                                ...patientForm,
                                emergencyContact: e.target.value,
                              })
                            }
                            placeholder="Name & phone of next of kin"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Optional Notes
                          </label>
                          <input
                            type="text"
                            value={patientForm.notes}
                            onChange={(e) =>
                              setPatientForm({ ...patientForm, notes: e.target.value })
                            }
                            placeholder="Any allergy or care note"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </div>
                      </div>

                      {/* Consent & Privacy Messaging */}
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="consent-check"
                          checked={patientForm.consentVerified}
                          onChange={(e) =>
                            setPatientForm({ ...patientForm, consentVerified: e.target.checked })
                          }
                          className="mt-0.5"
                        />
                        <label htmlFor="consent-check" className="text-slate-700 leading-relaxed">
                          <strong>Patient Consent Confirmation:</strong> I confirm that verbal or
                          written patient consent has been obtained to record essential primary care
                          details in accordance with NDPA 2023 privacy principles.
                        </label>
                      </div>

                      {patientValidation && (
                        <div className="rounded-lg border p-3.5 text-xs space-y-1.5 bg-slate-50 border-slate-200">
                          {patientValidation.blockingErrors.map((err, i) => (
                            <div key={i} className="text-red-600 font-semibold">
                              ✕ {err}
                            </div>
                          ))}
                          {patientValidation.reviewWarnings.map((w, i) => (
                            <div key={i} className="text-amber-700 font-medium">
                              ⚠ {w}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="submit"
                          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                        >
                          {isOffline
                            ? 'Save Patient on Device (Offline Queue)'
                            : 'Register & Save Patient'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Patient Table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <th className="py-3 px-4 font-semibold">Patient ID</th>
                            <th className="py-3 px-4 font-semibold">Full Name</th>
                            <th className="py-3 px-4 font-semibold">DOB · Age · Sex</th>
                            <th className="py-3 px-4 font-semibold">Community</th>
                            <th className="py-3 px-4 font-semibold">Phone / Emergency Contact</th>
                            <th className="py-3 px-4 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {patients.filter(
                            (p) =>
                              p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) ||
                              p.patientId.toLowerCase().includes(patientSearch.toLowerCase()) ||
                              p.community.toLowerCase().includes(patientSearch.toLowerCase())
                          ).length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-10 px-4 text-center space-y-2.5">
                                <div className="text-sm font-bold text-slate-900">
                                  {patientSearch
                                    ? 'No matching patients found'
                                    : 'No patients registered yet'}
                                </div>
                                <div className="text-xs text-slate-500 max-w-md mx-auto">
                                  {patientSearch
                                    ? `We could not find a patient matching “${patientSearch}”.`
                                    : 'Click "+ Register New Patient" below to add your first live patient record.'}
                                </div>
                                <div className="flex items-center justify-center gap-2 pt-1">
                                  {patientSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setPatientSearch('')}
                                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
                                    >
                                      Clear Search
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPatientSearch('');
                                      setShowNewPatientForm(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                                  >
                                    + Register New Patient
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {patients
                            .filter(
                              (p) =>
                                p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) ||
                                p.patientId.toLowerCase().includes(patientSearch.toLowerCase()) ||
                                p.community.toLowerCase().includes(patientSearch.toLowerCase())
                            )
                            .map((pt) => {
                              const dob = new Date(pt.dateOfBirth);
                              const refDate = new Date();
                              let ageYears = refDate.getFullYear() - dob.getFullYear();
                              const mDiff = refDate.getMonth() - dob.getMonth();
                              if (
                                mDiff < 0 ||
                                (mDiff === 0 && refDate.getDate() < dob.getDate())
                              ) {
                                ageYears--;
                              }
                              const ageLabel =
                                !isNaN(ageYears) && ageYears >= 0 ? `${ageYears} yrs` : '—';

                              return (
                                <tr key={pt.patientId} className="hover:bg-slate-50">
                                  <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                                    {pt.patientId}
                                  </td>
                                  <td className="py-3 px-4 font-medium text-slate-900">
                                    {pt.fullName}
                                  </td>
                                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                                    {pt.dateOfBirth} · {ageLabel} · {pt.sex}
                                  </td>
                                  <td className="py-3 px-4 text-slate-700">{pt.community}</td>
                                  <td className="py-3 px-4 text-slate-600">
                                    <div>{pt.phoneNumber}</div>
                                    <div className="text-[11px] text-slate-400">
                                      {pt.emergencyContact}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEncounterForm({
                                          ...encounterForm,
                                          patientId: pt.patientId,
                                          patientName: pt.fullName,
                                          community: pt.community,
                                        });
                                        setActiveTab('new-encounter');
                                      }}
                                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium whitespace-nowrap"
                                    >
                                      Record Visit →
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* NEW HEALTH VISIT FORM WITH AI CARE ASSISTANT */}
              {activeTab === 'new-encounter' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <div className="text-xs font-semibold text-teal-700">
                        Live Clinical Intake · Works Online &amp; Offline
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 mt-1">
                        Record New Health Visit
                      </h1>
                    </div>

                    <button
                      type="button"
                      disabled={visitAiLoading}
                      onClick={handleAskVisitAi}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start"
                    >
                      {visitAiLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                      )}
                      <span>
                        {visitAiLoading
                          ? 'AI Analyzing Vitals & Symptoms...'
                          : 'Ask AI Care Assistant to Draft Notes'}
                      </span>
                    </button>
                  </div>

                  {/* AI Visit Suggestion Card */}
                  {visitAiError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                      {visitAiError}
                    </div>
                  )}

                  {visitAiSuggestion && (
                    <div className="rounded-xl border border-teal-300 bg-teal-50/80 p-5 space-y-3 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
                          <span className="text-sm font-bold text-slate-900">
                            AI Care Assistant Suggestion
                          </span>
                        </div>
                        <span className="text-xs font-mono font-semibold text-teal-800">
                          Triage Priority: {visitAiSuggestion.triagePriority} · Follow-Up in{' '}
                          {visitAiSuggestion.followUpDays} days
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-white border border-teal-200/80">
                          <div className="font-bold text-slate-900 mb-1">
                            Suggested Observations:
                          </div>
                          <p className="text-slate-700">
                            {visitAiSuggestion.suggestedObservations}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-white border border-teal-200/80">
                          <div className="font-bold text-slate-900 mb-1">
                            Suggested Action Taken:
                          </div>
                          <p className="text-slate-700">{visitAiSuggestion.suggestedActionTaken}</p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-700">
                        <strong>Family Health Tip:</strong> {visitAiSuggestion.familyCareTip}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => applyAiVisitSuggestion(visitAiSuggestion)}
                          className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                        >
                          Apply Suggestions to Form
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisitAiSuggestion(null)}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Post-Save Concise Result Card */}
                  {lastSavedEncounterResult && (
                    <div className="rounded-xl border border-teal-300 bg-teal-50/90 p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0" />
                          <span className="text-sm font-bold text-slate-900">
                            {lastSavedEncounterResult.storedMode === 'offline_indexeddb'
                              ? 'Saved on this device in your Offline Sync Queue'
                              : 'Saved and synced directly to the live clinic database'}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-semibold">
                          Record Check:{' '}
                          {lastSavedEncounterResult.validation.qualityStatus === 'complete' ? (
                            <span className="text-emerald-700">✓ Complete</span>
                          ) : (
                            <span className="text-amber-700">⚠ Needs Review</span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-700">
                        Visit: <strong>{lastSavedEncounterResult.summary}</strong>
                      </div>

                      {lastSavedEncounterResult.validation.duplicateCandidate && (
                        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 space-y-1">
                          <div className="font-bold">Potential duplicate detected</div>
                          <div>
                            Matches existing visit:{' '}
                            <span className="font-mono font-semibold">
                              {lastSavedEncounterResult.validation.duplicateCandidate.summary}
                            </span>
                          </div>
                        </div>
                      )}

                      {lastSavedEncounterResult.validation.reviewWarnings.length > 0 && (
                        <ul className="text-xs text-amber-800 space-y-1">
                          {lastSavedEncounterResult.validation.reviewWarnings.map((w, idx) => (
                            <li key={idx}>• {w}</li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveTab('sync-center')}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                        >
                          Open Sync Center ({pendingOfflineItems.length} Pending)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('dashboard')}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold"
                        >
                          Return to Dashboard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Blocking Validation Errors Banner */}
                  {encounterValidation && !encounterValidation.isValidToSave && (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-2 text-xs text-red-800">
                      <div className="font-bold flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Please check the following fields before saving:</span>
                      </div>
                      <ul className="space-y-1 pl-5 list-disc">
                        {encounterValidation.blockingErrors.map((err, i) => (
                          <li key={i} className="font-medium">
                            {err}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => handleSaveEncounter(e)}
                    className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-6"
                  >
                    {/* Patient Selection or Direct Entry */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      {patients.length > 0 && (
                        <div className="sm:col-span-2 lg:col-span-4 pb-2 border-b border-slate-100">
                          <label className="block font-semibold text-slate-700 mb-1">
                            Quick Select Registered Patient (or type details below)
                          </label>
                          <select
                            value={encounterForm.patientId}
                            onChange={(e) => {
                              const pt = patients.find((p) => p.patientId === e.target.value);
                              if (pt) {
                                setEncounterForm({
                                  ...encounterForm,
                                  patientId: pt.patientId,
                                  patientName: pt.fullName,
                                  community: pt.community,
                                });
                              }
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                          >
                            <option value="">-- Select a registered patient --</option>
                            {patients.map((pt) => (
                              <option key={pt.patientId} value={pt.patientId}>
                                {pt.patientId} — {pt.fullName} ({pt.community})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Patient Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={encounterForm.patientName}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, patientName: e.target.value })
                          }
                          placeholder="Enter patient name"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Community / Ward *
                        </label>
                        <input
                          type="text"
                          required
                          value={encounterForm.community}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, community: e.target.value })
                          }
                          placeholder="Enter community or ward"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Visit Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={encounterForm.encounterDate}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, encounterDate: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Visit Type *
                        </label>
                        <select
                          value={encounterForm.encounterType}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, encounterType: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        >
                          <option value="General Outpatient">General Outpatient</option>
                          <option value="Maternal Health">Maternal Health</option>
                          <option value="Malaria / Febrile Triage">Malaria / Febrile Triage</option>
                          <option value="Child Immunization">Child Immunization</option>
                          <option value="Nutrition Screening">Nutrition Screening</option>
                          <option value="Chronic Care Follow-Up">Chronic Care Follow-Up</option>
                        </select>
                      </div>
                    </div>

                    {/* Vital Signs Grid */}
                    <div className="pt-4 border-t border-slate-100">
                      <h3 className="text-xs font-bold text-slate-900 mb-3">
                        Vital Signs (Checked automatically for safe physiological ranges)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Temperature (°C) *
                          </label>
                          <input
                            type="text"
                            required
                            value={encounterForm.temperature}
                            onChange={(e) =>
                              setEncounterForm({ ...encounterForm, temperature: e.target.value })
                            }
                            placeholder="e.g. 36.8"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Blood Pressure (mmHg) *
                          </label>
                          <input
                            type="text"
                            required
                            value={encounterForm.bloodPressure}
                            onChange={(e) =>
                              setEncounterForm({ ...encounterForm, bloodPressure: e.target.value })
                            }
                            placeholder="e.g. 120/80"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Heart Rate (bpm) *
                          </label>
                          <input
                            type="text"
                            required
                            value={encounterForm.heartRate}
                            onChange={(e) =>
                              setEncounterForm({ ...encounterForm, heartRate: e.target.value })
                            }
                            placeholder="e.g. 78"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Respiratory Rate (/min) *
                          </label>
                          <input
                            type="text"
                            required
                            value={encounterForm.respiratoryRate}
                            onChange={(e) =>
                              setEncounterForm({
                                ...encounterForm,
                                respiratoryRate: e.target.value,
                              })
                            }
                            placeholder="e.g. 18"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Clinical Assessment Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Reason for Visit *
                        </label>
                        <input
                          type="text"
                          required
                          value={encounterForm.reasonForVisit}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, reasonForVisit: e.target.value })
                          }
                          placeholder="Why did the patient visit today?"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Symptoms Reported
                        </label>
                        <input
                          type="text"
                          value={encounterForm.symptoms}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, symptoms: e.target.value })
                          }
                          placeholder="e.g. Fever, Headache, Cough"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-semibold text-slate-700">
                            Clinical Observations
                          </label>
                          <button
                            type="button"
                            onClick={handleAskVisitAi}
                            className="text-[11px] font-semibold text-teal-700 hover:underline"
                          >
                            ✨ Auto-Draft with AI
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={encounterForm.observations}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, observations: e.target.value })
                          }
                          placeholder="Summary of physical assessment..."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Care Action Taken
                        </label>
                        <textarea
                          rows={2}
                          value={encounterForm.actionTaken}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, actionTaken: e.target.value })
                          }
                          placeholder="Treatment, medicine, or counseling provided..."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>
                    </div>

                    {/* Referral & Follow-up Scheduling */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-4 border-t border-slate-100">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={encounterForm.referralRequired}
                            onChange={(e) =>
                              setEncounterForm({
                                ...encounterForm,
                                referralRequired: e.target.checked,
                              })
                            }
                          />
                          <span>Hospital Referral Needed?</span>
                        </label>
                        {encounterForm.referralRequired && (
                          <input
                            type="text"
                            value={encounterForm.referralFacility}
                            onChange={(e) =>
                              setEncounterForm({
                                ...encounterForm,
                                referralFacility: e.target.value,
                              })
                            }
                            placeholder="Target hospital or clinic name"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={encounterForm.followUpRequired}
                            onChange={(e) =>
                              setEncounterForm({
                                ...encounterForm,
                                followUpRequired: e.target.checked,
                              })
                            }
                          />
                          <span>Schedule Follow-Up Visit?</span>
                        </label>
                        {encounterForm.followUpRequired && (
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-0.5">
                              Follow-Up Due Date
                            </label>
                            <input
                              type="date"
                              value={encounterForm.followUpDate}
                              onChange={(e) =>
                                setEncounterForm({
                                  ...encounterForm,
                                  followUpDate: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Additional Notes
                        </label>
                        <input
                          type="text"
                          value={encounterForm.notes}
                          onChange={(e) =>
                            setEncounterForm({ ...encounterForm, notes: e.target.value })
                          }
                          placeholder="Optional family or care instructions"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        Save Destination:{' '}
                        <strong>
                          {isOffline
                            ? 'This Device (Offline Sync Queue)'
                            : 'Live Clinic Database (Online)'}
                        </strong>
                      </span>
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                      >
                        {isOffline ? 'Save Visit on Device' : 'Save & Sync Health Visit'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SYNCHRONIZATION CENTER */}
              {activeTab === 'sync-center' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <div className="text-xs font-semibold text-teal-700">
                        Device Storage &amp; Cloud Sync
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 mt-1">
                        Synchronization Center
                      </h1>
                      <p className="text-xs text-slate-500 mt-1">
                        Review records saved on this device while offline and send them to the
                        central clinic database.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={handleSyncNow}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start"
                    >
                      <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>
                        {isSyncing
                          ? `Syncing ${syncingCount} record(s)...`
                          : `Sync Now (${pendingOfflineItems.length} Pending)`}
                      </span>
                    </button>
                  </div>

                  {/* 4 Sync Status Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                      <div className="text-xs text-slate-500">Waiting on Device</div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                        {pendingOfflineItems.length} records
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Ready to send when online</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                      <div className="text-xs text-slate-500">Sending Now</div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-sky-600 mt-1">
                        {synchronizingItems.length} records
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Active encrypted transfer</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                      <div className="text-xs text-slate-500">Synced to Clinic</div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                        {encounters.length + localSyncedItems.length} records
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Confirmed in live database</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                      <div className="text-xs text-slate-500">Needs Retry</div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                        {failedItems.length} records
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Safe on device</div>
                    </div>
                  </div>

                  {/* Service Worker Offline Asset & API Cache Status */}
                  <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-teal-400">
                        OFFLINE APP READINESS ({swCacheStats?.activeState || 'Active'})
                      </div>
                      <h2 className="text-sm font-bold text-white">
                        App Screens &amp; Clinic Data Cached for Offline Work
                      </h2>
                      <p className="text-xs text-slate-300">
                        Core App Files:{' '}
                        <span className="font-mono text-white">
                          {swCacheStats?.coreAssetsCount || 7} files
                        </span>{' '}
                        · Offline Modules:{' '}
                        <span className="font-mono text-white">
                          {swCacheStats?.runtimeAssetsCount || 12} modules
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (authToken && user) {
                          await warmUpCriticalApiCaches(authToken, 'supervisor');
                          const stats = await getServiceWorkerCacheStats();
                          setSwCacheStats(stats);
                          setSyncBannerMessage(
                            'Offline app files and live clinic data cache refreshed on this device.'
                          );
                        }
                      }}
                      className="px-3.5 py-2 rounded-lg border border-teal-700/50 bg-teal-950/70 hover:bg-teal-900 text-teal-200 text-xs font-semibold transition-colors whitespace-nowrap self-start lg:self-center"
                    >
                      Refresh Offline Cache
                    </button>
                  </div>

                  {/* Queue Table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h2 className="text-sm font-bold text-slate-900">
                        Device &amp; Clinic Sync History
                      </h2>
                      <span className="text-xs text-slate-500">
                        Live Device Queue &amp; Server Ledger
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <th className="py-3 px-4 font-semibold">Patient ID</th>
                            <th className="py-3 px-4 font-semibold">Record Type</th>
                            <th className="py-3 px-4 font-semibold">Summary</th>
                            <th className="py-3 px-4 font-semibold">Saved Time</th>
                            <th className="py-3 px-4 font-semibold text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {offlineQueue.length === 0 && syncHistory.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-10 px-4 text-center space-y-2">
                                <div className="text-sm font-bold text-slate-900">
                                  No sync history entries yet
                                </div>
                                <div className="text-xs text-slate-500">
                                  When you record visits online or sync offline records, they will
                                  appear here.
                                </div>
                              </td>
                            </tr>
                          )}
                          {offlineQueue.map((item) => (
                            <tr
                              key={item.queueId}
                              className={item.status === 'Pending' ? 'bg-amber-50/50' : ''}
                            >
                              <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                                {item.patientId}
                              </td>
                              <td className="py-3 px-4 capitalize text-slate-800">
                                {item.recordType}
                              </td>
                              <td className="py-3 px-4 text-slate-700">{item.summary}</td>
                              <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                                {item.createdTime}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold">
                                {item.status === 'Pending' && (
                                  <span className="text-amber-700">Waiting on Device</span>
                                )}
                                {item.status === 'Synchronizing' && (
                                  <span className="text-sky-600">Syncing...</span>
                                )}
                                {item.status === 'Synchronized' && (
                                  <span className="text-emerald-700">Synced</span>
                                )}
                                {item.status === 'Failed' && (
                                  <span className="text-red-600">Retry Needed</span>
                                )}
                              </td>
                            </tr>
                          ))}

                          {syncHistory.map((sq) => (
                            <tr key={sq.queueItemId} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                                {sq.patientId}
                              </td>
                              <td className="py-3 px-4 text-slate-800">{sq.recordType}</td>
                              <td className="py-3 px-4 text-slate-600">{sq.payloadSummary}</td>
                              <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                                {sq.createdTime}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold">
                                {sq.status === 'Conflict' ? (
                                  <span className="text-amber-700">Conflict Flagged</span>
                                ) : (
                                  <span className="text-emerald-700">{sq.status}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* FOLLOW UP MANAGEMENT */}
              {activeTab === 'follow-ups' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <div className="text-xs font-semibold text-teal-700">
                        Continuity of Care &amp; Patient Checkups
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 mt-1">
                        Follow-Up Schedule ({followUps.length})
                      </h1>
                      <p className="text-xs text-slate-500 mt-1">
                        Summary:{' '}
                        <strong>
                          {followUps.filter((f) => f.status === 'Due Soon').length} due today
                        </strong>{' '}
                        ·{' '}
                        <strong>
                          {followUps.filter((f) => f.status === 'Overdue').length} overdue
                        </strong>{' '}
                        ·{' '}
                        <strong>
                          {followUps.filter((f) => f.status === 'Pending').length} upcoming
                        </strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start max-w-full">
                      {['all', 'Due Soon', 'Overdue', 'Pending', 'Completed'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFollowUpFilter(st)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            followUpFilter === st
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st === 'all' ? 'All Cases' : st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <th className="py-3 px-4 font-semibold">Patient</th>
                            <th className="py-3 px-4 font-semibold">Follow-Up Reason</th>
                            <th className="py-3 px-4 font-semibold">Assigned Staff</th>
                            <th className="py-3 px-4 font-semibold">Due Date</th>
                            <th className="py-3 px-4 font-semibold">Priority</th>
                            <th className="py-3 px-4 font-semibold">Status</th>
                            <th className="py-3 px-4 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {followUps.filter((f) =>
                            followUpFilter === 'all' ? true : f.status === followUpFilter
                          ).length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-10 px-4 text-center space-y-2">
                                <div className="text-sm font-bold text-slate-900">
                                  No {followUpFilter !== 'all' ? followUpFilter.toLowerCase() : ''}{' '}
                                  follow-up visits right now
                                </div>
                                <div className="text-xs text-slate-500">
                                  Check “Schedule Follow-Up Visit” when recording a patient visit to
                                  track upcoming checkups here.
                                </div>
                                {followUpFilter !== 'all' && (
                                  <button
                                    type="button"
                                    onClick={() => setFollowUpFilter('all')}
                                    className="mt-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
                                  >
                                    Show All Follow-Ups
                                  </button>
                                )}
                              </td>
                            </tr>
                          )}
                          {followUps
                            .filter((f) =>
                              followUpFilter === 'all' ? true : f.status === followUpFilter
                            )
                            .map((fup) => (
                              <tr key={fup.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900">
                                    {fup.patientName}
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-500">
                                    {fup.patientId} · {fup.community}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-700">{fup.reason}</td>
                                <td className="py-3 px-4 text-slate-700">
                                  {fup.assignedWorkerName}
                                </td>
                                <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                                  {fup.dueDate}
                                </td>
                                <td className="py-3 px-4 font-medium">
                                  <span
                                    className={
                                      fup.priority === 'High'
                                        ? 'text-red-600 font-semibold'
                                        : 'text-slate-700'
                                    }
                                  >
                                    {fup.priority}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-semibold">
                                  {fup.status === 'Overdue' && (
                                    <span className="text-red-600">Overdue</span>
                                  )}
                                  {fup.status === 'Due Soon' && (
                                    <span className="text-amber-700">Due Soon</span>
                                  )}
                                  {fup.status === 'Pending' && (
                                    <span className="text-slate-700">Pending</span>
                                  )}
                                  {fup.status === 'Completed' && (
                                    <span className="text-emerald-700">✓ Completed</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {fup.status !== 'Completed' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCompleteFollowUp(fup.id)}
                                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold whitespace-nowrap"
                                    >
                                      Mark Completed
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 font-mono">Verified</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ALL VISITS LIST */}
              {activeTab === 'encounters' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-5">
                    <div>
                      <div className="text-xs font-semibold text-teal-700">
                        Live Clinical Visit Ledger
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 mt-1">
                        All Recorded Health Visits ({encounters.length})
                      </h1>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('new-encounter')}
                      className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold self-start sm:self-center whitespace-nowrap"
                    >
                      + New Health Visit
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <th className="py-3 px-4 font-semibold">Visit Code</th>
                            <th className="py-3 px-4 font-semibold">Date</th>
                            <th className="py-3 px-4 font-semibold">Patient</th>
                            <th className="py-3 px-4 font-semibold">Type &amp; Reason</th>
                            <th className="py-3 px-4 font-semibold">Vitals</th>
                            <th className="py-3 px-4 font-semibold">Recorded By</th>
                            <th className="py-3 px-4 font-semibold text-right">Quality</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {encounters.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-10 px-4 text-center space-y-2.5">
                                <div className="text-sm font-bold text-slate-900">
                                  No visits recorded yet
                                </div>
                                <div className="text-xs text-slate-500">
                                  Click “+ New Health Visit” to record your first live patient
                                  visit.
                                </div>
                              </td>
                            </tr>
                          )}
                          {encounters.map((enc) => (
                            <tr key={enc.encounterCode} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                                {enc.encounterCode}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                                {enc.encounterDate}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{enc.patientName}</div>
                                <div className="text-[11px] text-slate-500">
                                  {enc.patientId} · {enc.community}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-800">
                                  {enc.encounterType}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {enc.reasonForVisit}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                                {enc.temperature}°C · {enc.bloodPressure} · HR {enc.heartRate}
                              </td>
                              <td className="py-3 px-4 text-slate-600">{enc.workerName}</td>
                              <td className="py-3 px-4 text-right font-medium">
                                {enc.dataQualityStatus === 'complete' ? (
                                  <span className="text-emerald-700">✓ Complete</span>
                                ) : enc.dataQualityStatus === 'duplicate_flagged' ? (
                                  <span className="text-red-600">⚠ Duplicate</span>
                                ) : (
                                  <span className="text-amber-700">⚠ Needs Review</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SETTINGS VIEW */}
              {activeTab === 'settings' && (
                <div className="space-y-6 max-w-3xl">
                  <div className="border-b border-slate-200 pb-5">
                    <div className="text-xs font-semibold text-teal-700">
                      Workspace &amp; Account Configuration
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">Platform Settings</h1>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-slate-100">
                      <div>
                        <div className="font-bold text-slate-900">Signed-In Operator</div>
                        <div className="text-slate-500">
                          {user.fullName} (@{user.username || 'daniel_idah'})
                        </div>
                      </div>
                      <span className="font-mono text-teal-700 shrink-0">Active Session</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-slate-100">
                      <div>
                        <div className="font-bold text-slate-900">Live Database &amp; Offline Sync</div>
                        <div className="text-slate-500">
                          Saves directly to Cloud SQL PostgreSQL when online and local device storage
                          when offline
                        </div>
                      </div>
                      <span className="font-mono text-emerald-700 shrink-0">Connected</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-slate-100">
                      <div>
                        <div className="font-bold text-slate-900">
                          AI Care &amp; Clinic Assistant
                        </div>
                        <div className="text-slate-500">
                          Server-side Gemini AI enabled for visit note drafting, triage guidance, and
                          live clinic insights
                        </div>
                      </div>
                      <span className="font-mono text-emerald-700 shrink-0">Enabled</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2">
                      <div>
                        <div className="font-bold text-slate-900">
                          NDPA 2023 Patient Privacy Mode
                        </div>
                        <div className="text-slate-500">
                          Requires explicit patient consent and protects personal health data
                        </div>
                      </div>
                      <span className="font-mono text-emerald-700 shrink-0">Enforced</span>
                    </div>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </main>

          {/* Functional Footer inside Workspace */}
          <SiteFooter
            onNavigatePage={(page) => setPublicPageOverride(page)}
            variant="light"
          />
        </div>
      </div>
    </div>
  );
}
