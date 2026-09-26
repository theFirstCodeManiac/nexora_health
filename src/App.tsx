import React, { useEffect, useState, useCallback } from 'react';
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
  PlayCircle,
} from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  OfflineQueueItem,
  getOfflineQueueItems,
  saveOfflineQueueItem,
  updateOfflineQueueItemStatus,
  getMetaValue,
  setMetaValue,
} from './lib/indexedDb.ts';
import {
  validateEncounterForm,
  validatePatientForm,
  ValidationResult,
} from './lib/validation.ts';
import { LoginView } from './components/LoginView.tsx';
import { SupervisorViews } from './components/SupervisorViews.tsx';
import { GuidedDemoBar } from './components/GuidedDemoBar.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';

interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: 'worker' | 'supervisor';
  workerCode: string;
  assignedCommunity: string;
}

export default function App() {
  // Auth state (token kept in memory, never in URL)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Navigation & Demo Mode state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [guidedDemoOpen, setGuidedDemoOpen] = useState<boolean>(true);
  const [demoStep, setDemoStep] = useState<number>(1);

  // Offline simulation & real network state
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const isOffline = simulatedOffline || !browserOnline;

  // Synchronization & IndexedDB Queue State
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncingCount, setSyncingCount] = useState<number>(0);
  const [syncBannerMessage, setSyncBannerMessage] = useState<string | null>(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string>('2026-09-26 09:02:12');

  // Server Bootstrap Data
  const [patients, setPatients] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // AI Intelligence State
  const [aiInsights, setAiInsights] = useState<any[] | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Patient Registration Form State
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [showNewPatientForm, setShowNewPatientForm] = useState<boolean>(false);
  const [patientForm, setPatientForm] = useState({
    patientId: '',
    fullName: '',
    dateOfBirth: '1994-06-15',
    sex: 'Female',
    phoneNumber: '+234-803-555-0192',
    community: 'Ungogo Ward A',
    emergencyContact: 'Musa Ibrahim (Spouse) +234-803-555-0199',
    notes: '',
    consentVerified: true,
  });
  const [patientValidation, setPatientValidation] = useState<ValidationResult | null>(null);
  const [patientSaveBanner, setPatientSaveBanner] = useState<string | null>(null);

  // Encounter Form State
  const [encounterForm, setEncounterForm] = useState({
    patientId: 'NXR-PT-1001',
    patientName: 'Zainab Abdullahi',
    community: 'Ungogo Ward A',
    encounterDate: '2026-09-26',
    encounterType: 'Maternal Health',
    reasonForVisit: 'Third-trimester antenatal vitals & fetal movement check',
    temperature: '37.1',
    bloodPressure: '122/78',
    heartRate: '80',
    respiratoryRate: '18',
    symptoms: 'Mild pedal edema, normal fetal movement',
    observations: 'Patient alert and hydrated; fundal height consistent with 30 weeks gestation.',
    actionTaken: 'Provided iron/folate supplementation and scheduled 14-day antenatal review.',
    referralRequired: false,
    referralFacility: '',
    followUpRequired: true,
    followUpDate: '2026-10-03',
    notes: 'Captured at Ungogo Ward A community health post.',
  });
  const [encounterValidation, setEncounterValidation] = useState<ValidationResult | null>(null);
  const [lastSavedEncounterResult, setLastSavedEncounterResult] = useState<{
    storedMode: 'offline_indexeddb' | 'online_postgres';
    validation: ValidationResult;
    summary: string;
  } | null>(null);

  // Follow-up filter state
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');

  // Load persisted IndexedDB queue & offline mode state on mount
  useEffect(() => {
    async function initLocalPersistence() {
      const savedQueue = await getOfflineQueueItems();
      setOfflineQueue(savedQueue);
      const savedOfflineMode = await getMetaValue<boolean>('simulatedOffline', false);
      setSimulatedOffline(savedOfflineMode);
      const savedLastSync = await getMetaValue<string>(
        'lastSyncTimestamp',
        '2026-09-26 09:02:12'
      );
      setLastSyncTimestamp(savedLastSync);

      // Load cached server state if available so refresh while offline still displays full records
      const cachedBootstrap = await getMetaValue<any>('cachedBootstrap', null);
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
  }, []);

  const toggleOfflineSimulation = async (nextState?: boolean) => {
    const target = typeof nextState === 'boolean' ? nextState : !simulatedOffline;
    setSimulatedOffline(target);
    await setMetaValue('simulatedOffline', target);
    if (!target) {
      setSyncBannerMessage(
        'Connection restored. Pending offline records in IndexedDB are ready to synchronize.'
      );
    } else {
      setSyncBannerMessage(null);
    }
  };

  // Fetch bootstrap data from PostgreSQL backend
  const fetchBootstrapData = useCallback(
    async (tokenOverride?: string, roleOverride?: 'worker' | 'supervisor') => {
      const activeToken = tokenOverride || authToken;
      if (!activeToken) return;
      if (isOffline) return;

      setDataLoading(true);
      try {
        const res = await fetch('/api/bootstrap', {
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'X-Nexora-Role': roleOverride || user?.role || 'worker',
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
        await setMetaValue('cachedBootstrap', data);
      } catch (err) {
        console.error('Bootstrap fetch error:', err);
      } finally {
        setDataLoading(false);
      }
    },
    [authToken, isOffline, user?.role]
  );

  // Demo credentials login handler
  const handleDemoLogin = async (
    email: string,
    password: string,
    role: 'worker' | 'supervisor'
  ) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      setAuthToken(data.token);
      setUser(data.user);
      setActiveTab('dashboard');
      await fetchBootstrapData(data.token, data.user.role);
    } catch (err: any) {
      setAuthError(err.message || 'Unable to sign in');
    } finally {
      setAuthLoading(false);
    }
  };

  // Google Sign-In handler
  const handleGoogleLogin = async (role: 'worker' | 'supervisor') => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-Nexora-Role': role,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify Google session');
      setAuthToken(idToken);
      setUser(data.user);
      setActiveTab('dashboard');
      await fetchBootstrapData(idToken, role);
    } catch (err: any) {
      setAuthError(err.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Switch between Frontline Worker & District Supervisor during live demo
  const handleSwitchRole = async (targetRole: 'worker' | 'supervisor') => {
    if (!user) return;
    const updatedUser: UserProfile =
      targetRole === 'supervisor'
        ? {
            uid: 'demo-supervisor-uid-001',
            email: 'supervisor@nexora.health',
            fullName: 'Dr. Tunde Okonkwo',
            role: 'supervisor',
            workerCode: 'SUP-002',
            assignedCommunity: 'Kano & Kaduna Catchment Zone',
          }
        : {
            uid: 'demo-worker-uid-001',
            email: 'worker@nexora.health',
            fullName: 'Amina Bello (CHW)',
            role: 'worker',
            workerCode: 'CHW-014',
            assignedCommunity: 'Ungogo Ward A',
          };
    const nextToken =
      targetRole === 'supervisor' ? 'nexora-demo-supervisor' : 'nexora-demo-worker';
    setUser(updatedUser);
    setAuthToken(nextToken);
    setActiveTab('dashboard');
    if (!isOffline) {
      await fetchBootstrapData(nextToken, targetRole);
    }
  };

  // Save Patient (Online or Offline IndexedDB)
  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePatientForm(patientForm, patients);
    setPatientValidation(validation);
    if (!validation.isValidToSave) return;

    const generatedId =
      patientForm.patientId.trim() || `NXR-PT-${1025 + patients.length + offlineQueue.length}`;
    const payload = {
      ...patientForm,
      patientId: generatedId,
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
      setPatientSaveBanner(
        `Patient ${generatedId} (${payload.fullName}) validated and stored locally in IndexedDB synchronization queue.`
      );
      setShowNewPatientForm(false);
    } else {
      try {
        const res = await fetch('/api/patients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Nexora-Role': user?.role || 'worker',
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to save patient online');
        await fetchBootstrapData();
        setPatientSaveBanner(
          `Patient ${generatedId} (${payload.fullName}) registered and synchronized with PostgreSQL.`
        );
        setShowNewPatientForm(false);
      } catch (err: any) {
        setPatientSaveBanner(`Error: ${err.message}`);
      }
    }
  };

  // Save Encounter (Online or Offline IndexedDB)
  const handleSaveEncounter = async (
    e?: React.FormEvent,
    overrideForm?: typeof encounterForm
  ) => {
    if (e) e.preventDefault();
    const targetForm = overrideForm || encounterForm;
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
    } else {
      try {
        const res = await fetch('/api/encounters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Nexora-Role': user?.role || 'worker',
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
      } catch (err: any) {
        console.error(err);
      }
    }
  };

  // Trigger Synchronization of Pending IndexedDB Records
  const handleSyncNow = async () => {
    if (isOffline) {
      setSyncBannerMessage(
        'Cannot synchronize while Offline Mode is active. Disable Simulated Offline Mode first to restore connectivity.'
      );
      return;
    }

    const pendingItems = offlineQueue.filter((item) => item.status === 'Pending');
    if (pendingItems.length === 0) {
      setSyncBannerMessage('All local device records are already synchronized with the server.');
      return;
    }

    setIsSyncing(true);
    setSyncingCount(pendingItems.length);
    setSyncBannerMessage(`Synchronizing ${pendingItems.length} record(s) with NEXORA PostgreSQL...`);

    try {
      // Mark items as Synchronizing in IndexedDB
      for (const item of pendingItems) {
        await updateOfflineQueueItemStatus(item.queueId, 'Synchronizing');
      }
      setOfflineQueue(await getOfflineQueueItems());

      // Brief visual beat so judges clearly see the Synchronizing state
      await new Promise((r) => setTimeout(r, 900));

      const res = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Nexora-Role': user?.role || 'worker',
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
      await setMetaValue('lastSyncTimestamp', syncedNow);

      await fetchBootstrapData();
      setSyncBannerMessage(
        `${syncData.syncedCount} record(s) synchronized successfully, validated, and published to the Supervisor Dashboard.`
      );
    } catch (err: any) {
      for (const item of pendingItems) {
        await updateOfflineQueueItemStatus(item.queueId, 'Failed');
      }
      setOfflineQueue(await getOfflineQueueItems());
      setSyncBannerMessage(`Synchronization error: ${err.message}`);
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
          'X-Nexora-Role': user?.role || 'worker',
        },
        body: JSON.stringify({
          outcomeNotes: 'Completed home/clinic follow-up and verified patient stability.',
        }),
      });
      if (res.ok) {
        await fetchBootstrapData();
      }
    } catch (err) {
      console.error('Complete follow-up error:', err);
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
          'X-Nexora-Role': user?.role || 'supervisor',
        },
        body: JSON.stringify({ resolutionStatus }),
      });
      if (res.ok) {
        await fetchBootstrapData();
      }
    } catch (err) {
      console.error('Resolve alert error:', err);
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
          'X-Nexora-Role': user?.role || 'supervisor',
        },
        body: JSON.stringify({ summaryMetrics }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gemini API call failed');
      }
      setAiInsights(data.insights || []);
    } catch (err: any) {
      setAiError(err.message || 'Unable to reach Gemini service');
    } finally {
      setAiLoading(false);
    }
  };

  // Guided 12-Step Demo Automation Handler
  const handleExecuteDemoStep = async (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        await handleSwitchRole('supervisor');
        setActiveTab('dashboard');
        setDemoStep(2);
        break;
      case 2:
        await handleSwitchRole('worker');
        setActiveTab('dashboard');
        setDemoStep(3);
        break;
      case 3:
        await toggleOfflineSimulation(true);
        setDemoStep(4);
        break;
      case 4: {
        const preset1 = {
          patientId: 'NXR-PT-1002',
          patientName: 'Suleiman Garba',
          community: 'Ungogo Ward A',
          encounterDate: '2026-09-26',
          encounterType: 'Malaria / Febrile Triage',
          reasonForVisit: 'Acute fever (38.6°C) and lethargy; rapid malaria RDT positive',
          temperature: '38.6',
          bloodPressure: '110/70',
          heartRate: '104',
          respiratoryRate: '24',
          symptoms: 'Fever, Chills, Reduced appetite',
          observations: 'RDT positive for P. falciparum; no danger signs; tolerating oral fluids.',
          actionTaken: 'Administered first dose weight-based ACT and paracetamol; scheduled 48h follow-up.',
          referralRequired: false,
          referralFacility: '',
          followUpRequired: true,
          followUpDate: '2026-09-28',
          notes: 'Captured offline during Ungogo Ward A outreach.',
        };
        setEncounterForm(preset1);
        setEncounterValidation(null);
        setLastSavedEncounterResult(null);
        setActiveTab('new-encounter');
        setDemoStep(5);
        break;
      }
      case 5:
        await handleSaveEncounter();
        setDemoStep(6);
        break;
      case 6: {
        const preset2 = {
          patientId: 'NXR-PT-1001',
          patientName: 'Zainab Abdullahi',
          community: 'Ungogo Ward A',
          encounterDate: '2026-09-26',
          encounterType: 'Maternal Health',
          reasonForVisit: 'Antenatal blood pressure & fetal movement follow-up (Offline Entry)',
          temperature: '37.0',
          bloodPressure: '144/92',
          heartRate: '88',
          respiratoryRate: '19',
          symptoms: 'Mild headache, elevated blood pressure',
          observations: 'BP elevated at 144/92 mmHg; requires close maternal monitoring.',
          actionTaken: 'Issued maternal hypertension advisory and flagged for supervisor review.',
          referralRequired: true,
          referralFacility: 'Murtala Muhammed Specialist Hospital',
          followUpRequired: true,
          followUpDate: '', // Intentionally blank to trigger Needs Review / Data Quality alert!
          notes: 'Second offline encounter captured before returning to cellular coverage.',
        };
        setEncounterForm(preset2);
        await handleSaveEncounter(undefined, preset2);
        setActiveTab('new-encounter');
        setDemoStep(7);
        break;
      }
      case 7:
        await toggleOfflineSimulation(false);
        setDemoStep(8);
        break;
      case 8:
        setActiveTab('sync-center');
        setDemoStep(9);
        break;
      case 9:
        await handleSyncNow();
        setDemoStep(10);
        break;
      case 10:
        await handleSwitchRole('supervisor');
        setActiveTab('dashboard');
        setDemoStep(11);
        break;
      case 11:
        if (user?.role !== 'supervisor') await handleSwitchRole('supervisor');
        setActiveTab('data-quality');
        setDemoStep(12);
        break;
      case 12:
        if (user?.role !== 'supervisor') await handleSwitchRole('supervisor');
        setActiveTab('intelligence');
        break;
      default:
        break;
    }
  };

  // Render Login View if unauthenticated
  if (!user || !authToken) {
    return (
      <LoginView
        onDemoLogin={handleDemoLogin}
        onGoogleLogin={handleGoogleLogin}
        error={authError}
        loading={authLoading}
      />
    );
  }

  // Derived Counts
  const pendingOfflineItems = offlineQueue.filter((i) => i.status === 'Pending');
  const synchronizingItems = offlineQueue.filter((i) => i.status === 'Synchronizing');
  const localSyncedItems = offlineQueue.filter((i) => i.status === 'Synchronized');
  const failedItems = offlineQueue.filter((i) => i.status === 'Failed');

  const todayEncountersCount =
    encounters.filter((e) => e.encounterDate === '2026-09-26').length +
    pendingOfflineItems.filter((i) => i.recordType === 'encounter').length;

  const dueFollowUpsCount = followUps.filter(
    (f) => f.status === 'Due Soon' || f.status === 'Overdue'
  ).length;

  const openAlertsCount = alerts.filter((a) => a.status === 'Open').length;

  // Navigation items by role (matching Section 22)
  const workerNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'new-encounter', label: 'New Encounter', icon: FilePlus2 },
    { id: 'follow-ups', label: 'Follow Ups', icon: CalendarClock },
    {
      id: 'sync-center',
      label: `Sync Center (${pendingOfflineItems.length})`,
      icon: RefreshCw,
    },
    { id: 'my-activity', label: 'My Activity', icon: Activity },
  ];

  const supervisorNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'encounters', label: 'Encounters', icon: FileText },
    { id: 'follow-ups', label: 'Follow Ups', icon: CalendarClock },
    { id: 'data-quality', label: `Data Quality (${openAlertsCount})`, icon: ShieldAlert },
    { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
    { id: 'interoperability', label: 'Interoperability', icon: Network },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'audit-log', label: 'Audit Log', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navItems = user.role === 'supervisor' ? supervisorNavItems : workerNavItems;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Guided 12-Step Demo Walkthrough Bar */}
      <GuidedDemoBar
        isOpen={guidedDemoOpen}
        currentStep={demoStep}
        onClose={() => setGuidedDemoOpen(false)}
        onSelectStep={(s) => setDemoStep(s)}
        onExecuteStep={handleExecuteDemoStep}
      />

      {/* Persistent Offline Mode Active Banner (Section 6) */}
      {isOffline && (
        <div className="bg-amber-600 text-white px-4 py-2.5 border-b border-amber-700">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>Offline Mode Active:</strong> Your data is being securely stored on this
                device (IndexedDB) and will synchronize when connectivity returns.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono">
                Pending Local Queue: {pendingOfflineItems.length} record(s)
              </span>
              <button
                type="button"
                onClick={() => toggleOfflineSimulation(false)}
                className="px-2.5 py-1 rounded bg-white text-amber-900 font-semibold hover:bg-amber-50 transition-colors whitespace-nowrap"
              >
                Restore Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout: Sidebar + Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 bg-slate-950 text-slate-200 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 shrink-0">
          <div>
            {/* Brand Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-teal-950 border border-teal-700/60 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 64 64" fill="none">
                    <path
                      d="M26 12H38V26H52V38H38V52H26V38H12V26H26V12Z"
                      stroke="#14B8A6"
                      strokeWidth="4"
                    />
                    <circle cx="32" cy="32" r="5" fill="#F8FAFC" />
                  </svg>
                </div>
                <span className="font-bold tracking-tight text-white text-base">
                  NEXORA Health
                </span>
              </div>
            </div>

            {/* Operator Identity & Role Switcher */}
            <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/50">
              <div>
                <div className="text-xs font-semibold text-white">{user.fullName}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {user.workerCode} · {user.assignedCommunity}
                </div>
              </div>

              {/* Quick Role Switcher for Judges */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSwitchRole('worker')}
                  className={`py-1.5 px-2 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    user.role === 'worker'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Frontline Worker
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('supervisor')}
                  className={`py-1.5 px-2 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    user.role === 'supervisor'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Supervisor
                </button>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
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

          {/* Sidebar Bottom Controls: PWA Install + Demo Mode + Logout */}
          <div className="p-4 border-t border-slate-800 space-y-2.5">
            <PWAInstallButton />

            {!guidedDemoOpen && (
              <button
                type="button"
                onClick={() => setGuidedDemoOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5 text-teal-400" />
                <span>Open 12-Step Demo Guide</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setUser(null);
                setAuthToken(null);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Right Main Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Operational Header with Persistent Connectivity Indicator & Simulate Offline Mode Toggle */}
          <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                {user.role === 'supervisor' ? 'Supervisor Operations' : 'Frontline Field Capture'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Last Sync: {lastSyncTimestamp}</span>
              {dataLoading && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-teal-700 font-mono">Refreshing...</span>
                </>
              )}
            </div>

            {/* Persistent Connectivity Status + Simulate Offline Mode Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                {isOffline ? (
                  <>
                    <span aria-hidden="true">🔴</span>
                    <span className="text-red-700">Offline</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">🟢</span>
                    <span className="text-emerald-700">Connected</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => toggleOfflineSimulation()}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                  simulatedOffline
                    ? 'bg-amber-600 border-amber-700 text-white hover:bg-amber-700'
                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {simulatedOffline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Simulate Offline Mode: ON (Click to Reconnect)</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Simulate Offline Mode</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Synchronization Status Notification Banner */}
          {syncBannerMessage && (
            <div className="bg-teal-950 text-teal-100 px-6 py-2.5 border-b border-teal-800 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                )}
                <span>{syncBannerMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncBannerMessage(null)}
                className="text-teal-300 hover:text-white text-xs font-mono"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main Content Container */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {/* SUPERVISOR SPECIFIC VIEWS */}
            {user.role === 'supervisor' &&
              ['dashboard', 'data-quality', 'intelligence', 'interoperability', 'security', 'audit-log'].includes(
                activeTab
              ) && (
                <SupervisorViews
                  activeTab={activeTab}
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
              )}

            {/* FRONTLINE WORKER DASHBOARD (Section 5) */}
            {user.role === 'worker' && activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <div className="text-xs font-mono text-teal-700">
                      FRONTLINE WORKER FIELD WORKSPACE · {user.assignedCommunity.toUpperCase()}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">
                      Welcome, {user.fullName}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Connectivity: {isOffline ? '🔴 Offline (IndexedDB Queue Active)' : '🟢 Connected'} · Last successful synchronization: {lastSyncTimestamp}
                    </p>
                  </div>

                  {/* Primary Action Buttons (Section 5) */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLastSavedEncounterResult(null);
                        setActiveTab('new-encounter');
                      }}
                      className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      + New Encounter
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('patients')}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Patients
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('sync-center');
                        if (!isOffline && pendingOfflineItems.length > 0) {
                          handleSyncNow();
                        }
                      }}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Sync Data ({pendingOfflineItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('follow-ups')}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Follow Ups
                    </button>
                  </div>
                </div>

                {/* 4 Key Frontline Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Today&apos;s encounters</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {todayEncountersCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Captured in {user.assignedCommunity}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Pending synchronization</div>
                    <div
                      className={`text-3xl font-bold font-mono tabular-nums mt-1 ${
                        pendingOfflineItems.length > 0 ? 'text-amber-600' : 'text-emerald-700'
                      }`}
                    >
                      {pendingOfflineItems.length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {pendingOfflineItems.length > 0
                        ? 'Stored locally in IndexedDB'
                        : 'All local records synced'}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Follow ups due</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {dueFollowUpsCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Due today or overdue in catchment
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Data quality alerts</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                      {openAlertsCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Flagged for completeness or duplicate check
                    </div>
                  </div>
                </div>

                {/* Pending Local Queue Preview (when records are waiting in IndexedDB) */}
                {pendingOfflineItems.length > 0 && (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Local Device Queue (Waiting for Synchronization)
                        </h2>
                        <p className="text-xs text-slate-600">
                          These records are persisted in browser IndexedDB and will survive a page
                          refresh.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sync-center')}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap self-start"
                      >
                        Open Sync Center →
                      </button>
                    </div>
                    <div className="divide-y divide-amber-200/60 text-xs">
                      {pendingOfflineItems.map((item) => (
                        <div
                          key={item.queueId}
                          className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-semibold text-slate-900">
                              {item.patientId}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-medium text-slate-800">{item.summary}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-slate-600">
                            <span>{item.createdTime}</span>
                            <span className="text-amber-800 font-semibold">Stored Locally</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Encounters Table */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-900">Recent Health Encounters</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('new-encounter')}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      + Record Another Encounter
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 pr-3 font-semibold">Encounter ID</th>
                          <th className="py-2.5 px-3 font-semibold">Patient</th>
                          <th className="py-2.5 px-3 font-semibold">Encounter Type</th>
                          <th className="py-2.5 px-3 font-semibold">Vitals</th>
                          <th className="py-2.5 px-3 font-semibold">Data Quality</th>
                          <th className="py-2.5 pl-3 font-semibold text-right">Sync Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
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
                                  <span className="text-amber-700 font-medium">⚠ Needs Review</span>
                                )}
                              </td>
                              <td className="py-3 pl-3 text-right font-mono text-amber-700 font-semibold">
                                Pending Local Sync
                              </td>
                            </tr>
                          ))}
                        {encounters.slice(0, 8).map((enc) => (
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
                              Synchronized
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PATIENTS REGISTRY & REGISTRATION FORM (Section 8) */}
            {activeTab === 'patients' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <div className="text-xs font-mono text-teal-700">
                      COMMUNITY PATIENT REGISTRY · NDPA 2023 DATA MINIMIZATION
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">
                      Registered Patients ({patients.length})
                    </h1>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
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
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showNewPatientForm ? 'Close Form' : 'Register Patient'}</span>
                    </button>
                  </div>
                </div>

                {patientSaveBanner && (
                  <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-xs text-teal-900 flex items-center justify-between">
                    <span>{patientSaveBanner}</span>
                    <button
                      type="button"
                      onClick={() => setPatientSaveBanner(null)}
                      className="font-semibold underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {showNewPatientForm && (
                  <form
                    onSubmit={handleSavePatient}
                    className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          New Patient Registration
                        </h2>
                        <p className="text-xs text-slate-500">
                          Leave Patient ID blank to auto-generate a unique NEXORA identifier. Works
                          online and offline.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPatientForm({
                            patientId: 'NXR-PT-1001',
                            fullName: 'Zainab Abdullahi',
                            dateOfBirth: '1996-04-12',
                            sex: 'Female',
                            phoneNumber: '+234-803-010-1001',
                            community: 'Ungogo Ward A',
                            emergencyContact: 'Yusuf Abdullahi +234-803-010-9001',
                            notes: 'Testing duplicate patient detection.',
                            consentVerified: true,
                          })
                        }
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        Prefill Duplicate Patient Test
                      </button>
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
                          placeholder="e.g. NXR-PT-1055"
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
                          placeholder="e.g. Hauwa Danjuma"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Date of Birth *
                        </label>
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
                        <label className="block font-semibold text-slate-700 mb-1">Sex *</label>
                        <select
                          value={patientForm.sex}
                          onChange={(e) => setPatientForm({ ...patientForm, sex: e.target.value })}
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
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Community Catchment *
                        </label>
                        <select
                          value={patientForm.community}
                          onChange={(e) =>
                            setPatientForm({ ...patientForm, community: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        >
                          <option value="Ungogo Ward A">Ungogo Ward A</option>
                          <option value="Sabon Gari Rural">Sabon Gari Rural</option>
                          <option value="Kumbotso South">Kumbotso South</option>
                          <option value="Zaria Outpost B">Zaria Outpost B</option>
                          <option value="Bichi North">Bichi North</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Emergency Contact
                        </label>
                        <input
                          type="text"
                          value={patientForm.emergencyContact}
                          onChange={(e) =>
                            setPatientForm({ ...patientForm, emergencyContact: e.target.value })
                          }
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
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>
                    </div>

                    {/* Consent & Privacy Messaging (Section 8) */}
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
                        <strong>Informed Consent & Data Minimization Notice:</strong> I confirm that
                        verbal or written patient consent has been obtained to record essential
                        primary care data in accordance with Nigeria Data Protection Act (NDPA) 2023
                        data minimization guidelines.
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
                        className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                      >
                        {isOffline
                          ? 'Save Patient Locally (Offline Queue)'
                          : 'Register & Synchronize Patient'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Patient Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4 font-semibold">Patient ID</th>
                          <th className="py-3 px-4 font-semibold">Full Name</th>
                          <th className="py-3 px-4 font-semibold">DOB · Sex</th>
                          <th className="py-3 px-4 font-semibold">Community</th>
                          <th className="py-3 px-4 font-semibold">Phone / Emergency Contact</th>
                          <th className="py-3 px-4 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {patients
                          .filter(
                            (p) =>
                              p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) ||
                              p.patientId.toLowerCase().includes(patientSearch.toLowerCase()) ||
                              p.community.toLowerCase().includes(patientSearch.toLowerCase())
                          )
                          .map((pt) => (
                            <tr key={pt.patientId} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                                {pt.patientId}
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {pt.fullName}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                                {pt.dateOfBirth} · {pt.sex}
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
                                  Record Encounter →
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* NEW HEALTH ENCOUNTER FORM (Section 9 & 10) */}
            {activeTab === 'new-encounter' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <div className="text-xs font-mono text-teal-700">
                      STRUCTURED CLINICAL INTAKE · WORKS ONLINE & OFFLINE
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">
                      New Health Encounter
                    </h1>
                  </div>

                  {/* Quick Demo Validation Presets */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Demo Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEncounterValidation(null);
                        setLastSavedEncounterResult(null);
                        setEncounterForm({
                          patientId: 'NXR-PT-1002',
                          patientName: 'Suleiman Garba',
                          community: 'Ungogo Ward A',
                          encounterDate: '2026-09-26',
                          encounterType: 'Malaria / Febrile Triage',
                          reasonForVisit: 'Fever for 48 hours; RDT positive for malaria',
                          temperature: '38.5',
                          bloodPressure: '112/72',
                          heartRate: '96',
                          respiratoryRate: '22',
                          symptoms: 'Fever, Chills, Fatigue',
                          observations: 'Patient alert; RDT positive; no severe danger signs.',
                          actionTaken: 'Dispensed artemether-lumefantrine (ACT) and paracetamol.',
                          referralRequired: false,
                          referralFacility: '',
                          followUpRequired: true,
                          followUpDate: '2026-09-28',
                          notes: 'Standard offline field capture.',
                        });
                      }}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800"
                    >
                      1. Complete Record
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEncounterValidation(null);
                        setLastSavedEncounterResult(null);
                        setEncounterForm({
                          patientId: 'NXR-PT-1001',
                          patientName: 'Zainab Abdullahi',
                          community: 'Ungogo Ward A',
                          encounterDate: '2026-09-26',
                          encounterType: 'Maternal Health',
                          reasonForVisit: 'Routine antenatal vitals and fetal movement check',
                          temperature: '36.8',
                          bloodPressure: '118/76',
                          heartRate: '78',
                          respiratoryRate: '18',
                          symptoms: 'None reported',
                          observations: 'Repeat entry on same date/type to demonstrate duplicate detection.',
                          actionTaken: 'Routine antenatal check.',
                          referralRequired: false,
                          referralFacility: '',
                          followUpRequired: false,
                          followUpDate: '',
                          notes: 'Triggers Potential Duplicate Detection.',
                        });
                      }}
                      className="px-2.5 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-medium text-amber-900"
                    >
                      2. Duplicate Candidate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEncounterValidation(null);
                        setLastSavedEncounterResult(null);
                        setEncounterForm({
                          ...encounterForm,
                          temperature: '49.5',
                          bloodPressure: '310/210',
                          heartRate: '290',
                        });
                      }}
                      className="px-2.5 py-1 rounded border border-red-300 bg-red-50 hover:bg-red-100 text-xs font-medium text-red-800"
                    >
                      3. Impossible Vitals Error
                    </button>
                  </div>
                </div>

                {/* Post-Save Concise Result Card (Section 10) */}
                {lastSavedEncounterResult && (
                  <div className="rounded-xl border border-teal-300 bg-teal-50/90 p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0" />
                        <span className="text-sm font-bold text-slate-900">
                          {lastSavedEncounterResult.storedMode === 'offline_indexeddb'
                            ? 'Stored locally in device IndexedDB synchronization queue'
                            : 'Synchronized directly to NEXORA PostgreSQL'}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-semibold">
                        Data Quality:{' '}
                        {lastSavedEncounterResult.validation.qualityStatus === 'complete' ? (
                          <span className="text-emerald-700">✓ Complete</span>
                        ) : (
                          <span className="text-amber-700">⚠ Needs Review</span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-700">
                      Record: <strong>{lastSavedEncounterResult.summary}</strong>
                    </div>

                    {lastSavedEncounterResult.validation.duplicateCandidate && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 space-y-1">
                        <div className="font-bold">Potential duplicate detected</div>
                        <div>
                          Matches existing record:{' '}
                          <span className="font-mono font-semibold">
                            {lastSavedEncounterResult.validation.duplicateCandidate.summary}
                          </span>
                        </div>
                        <div className="text-[11px]">
                          Flagged automatically for Supervisor review in the Data Quality Center.
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

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('sync-center')}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                      >
                        Open Synchronization Center ({pendingOfflineItems.length} Pending)
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
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Validation Failed — Please correct errors before saving:</span>
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
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
                >
                  {/* Patient & Encounter Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Select Registered Patient *
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
                        {patients.map((pt) => (
                          <option key={pt.patientId} value={pt.patientId}>
                            {pt.patientId} — {pt.fullName} ({pt.community})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Encounter Date *
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
                        Encounter Type *
                      </label>
                      <select
                        value={encounterForm.encounterType}
                        onChange={(e) =>
                          setEncounterForm({ ...encounterForm, encounterType: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      >
                        <option value="Maternal Health">Maternal Health</option>
                        <option value="Malaria / Febrile Triage">Malaria / Febrile Triage</option>
                        <option value="Child Immunization">Child Immunization</option>
                        <option value="Nutrition Screening">Nutrition Screening</option>
                        <option value="Chronic Care Follow-Up">Chronic Care Follow-Up</option>
                        <option value="General Outpatient">General Outpatient</option>
                      </select>
                    </div>
                  </div>

                  {/* Vital Signs Grid */}
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-900 mb-3">
                      Vital Signs (Validated against physiological bounds & mapped to LOINC)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
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
                          placeholder="36.8"
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
                          placeholder="120/80"
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
                          placeholder="78"
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
                            setEncounterForm({ ...encounterForm, respiratoryRate: e.target.value })
                          }
                          placeholder="18"
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
                        placeholder="e.g. Fever, Headache, Chills"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Clinical Observations
                      </label>
                      <textarea
                        rows={2}
                        value={encounterForm.observations}
                        onChange={(e) =>
                          setEncounterForm({ ...encounterForm, observations: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Action Taken / Intervention
                      </label>
                      <textarea
                        rows={2}
                        value={encounterForm.actionTaken}
                        onChange={(e) =>
                          setEncounterForm({ ...encounterForm, actionTaken: e.target.value })
                        }
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
                        <span>Referral Required?</span>
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
                          placeholder="Target hospital / clinic name"
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
                        <span>Follow-Up Required?</span>
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
                        Additional Field Notes
                      </label>
                      <input
                        type="text"
                        value={encounterForm.notes}
                        onChange={(e) =>
                          setEncounterForm({ ...encounterForm, notes: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      Storage Target:{' '}
                      <strong>
                        {isOffline
                          ? 'Local IndexedDB Queue (Offline Mode Active)'
                          : 'NEXORA PostgreSQL Server (Online)'}
                      </strong>
                    </span>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                    >
                      {isOffline
                        ? 'Validate & Save Encounter Locally'
                        : 'Validate & Synchronize Encounter'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SYNCHRONIZATION CENTER (Section 11) */}
            {activeTab === 'sync-center' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <div className="text-xs font-mono text-teal-700">
                      INDEXEDDB OFFLINE QUEUE & BATCH SYNCHRONIZATION ENGINE
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">
                      Synchronization Center
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Manage locally persisted health records and trigger batch transmission to the
                      district PostgreSQL database.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={handleSyncNow}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncing
                        ? `Synchronizing ${syncingCount} record(s)...`
                        : `Sync Now (${pendingOfflineItems.length} Pending)`}
                    </span>
                  </button>
                </div>

                {/* 4 Sync Status Counters (Section 11) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Pending</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                      {pendingOfflineItems.length} records
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Waiting in local IndexedDB</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Synchronizing</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-sky-600 mt-1">
                      {synchronizingItems.length} records
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Active TLS batch upload</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Synchronized</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                      {encounters.length + localSyncedItems.length} records
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Confirmed in PostgreSQL</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">Failed</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {failedItems.length} records
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Zero dropped packets</div>
                  </div>
                </div>

                {/* Queue Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">
                      Device & Server Synchronization Queue Ledger
                    </h2>
                    <span className="text-xs font-mono text-slate-500">
                      Persistence: Browser IndexedDB + Cloud SQL PostgreSQL
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4 font-semibold">Patient ID</th>
                          <th className="py-3 px-4 font-semibold">Record Type</th>
                          <th className="py-3 px-4 font-semibold">Summary</th>
                          <th className="py-3 px-4 font-semibold">Created Time</th>
                          <th className="py-3 px-4 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
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
                                <span className="text-amber-700">Pending (Local IndexedDB)</span>
                              )}
                              {item.status === 'Synchronizing' && (
                                <span className="text-sky-600">Synchronizing...</span>
                              )}
                              {item.status === 'Synchronized' && (
                                <span className="text-emerald-700">Synchronized</span>
                              )}
                              {item.status === 'Failed' && (
                                <span className="text-red-600">Failed</span>
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

            {/* FOLLOW UP MANAGEMENT (Section 15) */}
            {activeTab === 'follow-ups' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <div className="text-xs font-mono text-teal-700">
                      CONTINUITY OF CARE & COMMUNITY TRACKING
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">
                      Follow-Up Case Management
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

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
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
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4 font-semibold">Patient</th>
                          <th className="py-3 px-4 font-semibold">Follow-Up Reason</th>
                          <th className="py-3 px-4 font-semibold">Assigned Worker</th>
                          <th className="py-3 px-4 font-semibold">Due Date</th>
                          <th className="py-3 px-4 font-semibold">Priority</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
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

            {/* ALL ENCOUNTERS LIST (Supervisor Encounters View or Worker My Activity View) */}
            {(activeTab === 'encounters' || activeTab === 'my-activity') && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-5">
                  <div>
                    <div className="text-xs font-mono text-teal-700">
                      CLINICAL ENCOUNTER LEDGER
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">
                      {activeTab === 'my-activity'
                        ? `My Recorded Activity (${user.fullName})`
                        : `All Synchronized District Encounters (${encounters.length})`}
                    </h1>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('new-encounter')}
                    className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                  >
                    + New Encounter
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4 font-semibold">Encounter Code</th>
                          <th className="py-3 px-4 font-semibold">Date</th>
                          <th className="py-3 px-4 font-semibold">Patient</th>
                          <th className="py-3 px-4 font-semibold">Type & Reason</th>
                          <th className="py-3 px-4 font-semibold">Vitals</th>
                          <th className="py-3 px-4 font-semibold">Worker</th>
                          <th className="py-3 px-4 font-semibold text-right">Quality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {encounters.slice(0, 30).map((enc) => (
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
                              <div className="font-medium text-slate-800">{enc.encounterType}</div>
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
                  <div className="text-xs font-mono text-teal-700">
                    ORGANIZATION & INFRASTRUCTURE CONFIGURATION
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mt-1">Platform Settings</h1>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900">Organization Network</div>
                      <div className="text-slate-500">
                        Northern Primary Health Infrastructure Network (ORG-NGA-PHC-01)
                      </div>
                    </div>
                    <span className="font-mono text-teal-700">Active</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900">
                        Offline Persistence Engine (IndexedDB)
                      </div>
                      <div className="text-slate-500">
                        Stores encounters & registrations locally when field connectivity drops
                      </div>
                    </div>
                    <span className="font-mono text-emerald-700">Enabled</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900">
                        NDPA 2023 Data Minimization Mode
                      </div>
                      <div className="text-slate-500">
                        Requires explicit patient consent and restricts unnecessary PII collection
                      </div>
                    </div>
                    <span className="font-mono text-emerald-700">Enforced</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-bold text-slate-900">Guided 12-Step Demo Bar</div>
                      <div className="text-slate-500">
                        Toggle the interactive judge walkthrough bar at the top of the screen
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuidedDemoOpen(!guidedDemoOpen)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
                    >
                      {guidedDemoOpen ? 'Hide Demo Bar' : 'Show Demo Bar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
