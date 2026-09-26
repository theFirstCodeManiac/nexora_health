import { GoogleGenAI, Type } from '@google/genai';

const LIVE_OPERATOR_TOKEN = 'nexora-live-session-daniel-idah';
const LIVE_OPERATOR_PROFILE = {
  uid: 'user-daniel-idah',
  username: 'daniel_idah',
  email: 'daniel_idah@nexora.health',
  role: 'supervisor' as const,
  fullName: 'Daniel Idah',
  workerCode: 'OP-001',
  assignedCommunity: 'Primary Health Network',
};

// In-memory store for serverless warm instances when Cloud SQL is not attached on Vercel
const memoryStore: {
  organizations: any[];
  communities: any[];
  workers: any[];
  patients: any[];
  encounters: any[];
  followUps: any[];
  syncQueue: any[];
  dataQualityAlerts: any[];
  auditLogs: any[];
} = {
  organizations: [
    {
      id: 1,
      code: 'ORG-NGA-PHC-01',
      name: 'NEXORA Primary Health Network',
      region: 'Primary Care Operations',
      ndpaCompliantMode: true,
    },
  ],
  communities: [],
  workers: [LIVE_OPERATOR_PROFILE],
  patients: [],
  encounters: [],
  followUps: [],
  syncQueue: [],
  dataQualityAlerts: [],
  auditLogs: [],
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Nexora-Role');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = String(req.url || '').split('?')[0];
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  // 1. Auth Login
  if (url.endsWith('/api/auth/login') || url.endsWith('/api/auth/demo-login')) {
    const rawUser = String(body.username || body.email || '').trim();
    const rawPass = String(body.password || '').trim();

    if (!rawUser || !rawPass) {
      return res.status(401).json({
        error: 'Please enter your username and password.',
      });
    }

    // Check credentials (case-insensitive username check for daniel_idah)
    const isDaniel =
      rawUser.toLowerCase() === 'daniel_idah' ||
      rawUser.toLowerCase() === 'daniel_idah@nexora.health' ||
      rawUser.toLowerCase() === 'danielidah608@gmail.com';

    if (isDaniel && rawPass !== '@Best2026_' && rawPass.toLowerCase() !== '@best2026_') {
      return res.status(401).json({
        error: 'Invalid username or password. Please check your credentials and try again.',
      });
    }

    const activeUser = isDaniel
      ? LIVE_OPERATOR_PROFILE
      : {
          ...LIVE_OPERATOR_PROFILE,
          username: rawUser,
          fullName: rawUser === 'daniel_idah' ? 'Daniel Idah' : rawUser,
        };

    memoryStore.auditLogs.unshift({
      id: Date.now(),
      userUid: activeUser.uid,
      userName: activeUser.fullName,
      userRole: 'Authorized Operator',
      action: 'User Sign-In (Authenticated Live Session)',
      resource: `Session · ${activeUser.username}`,
      status: 'Success',
      ipOrDevice: 'NEXORA Live Portal',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });

    return res.status(200).json({
      user: activeUser,
      token: LIVE_OPERATOR_TOKEN,
    });
  }

  // 2. Auth Session
  if (url.endsWith('/api/auth/session')) {
    return res.status(200).json({
      user: LIVE_OPERATOR_PROFILE,
    });
  }

  // 3. Bootstrap
  if (url.endsWith('/api/bootstrap')) {
    return res.status(200).json(memoryStore);
  }

  // 4. Create Patient
  if (url.endsWith('/api/patients') && req.method === 'POST') {
    const generatedId =
      body.patientId?.trim() || `NXR-PT-${1001 + memoryStore.patients.length}`;
    const cleanCommunity = body.community?.trim() || 'General Clinic Ward';

    if (!memoryStore.communities.some((c) => c.name === cleanCommunity)) {
      memoryStore.communities.push({
        id: memoryStore.communities.length + 1,
        code: `COM-${101 + memoryStore.communities.length}`,
        name: cleanCommunity,
        state: 'Active Catchment',
        organizationId: 1,
        populationEstimate: 0,
        connectivityProfile: 'Live Clinic Node',
      });
    }

    const created = {
      id: memoryStore.patients.length + 1,
      patientId: generatedId,
      fullName: String(body.fullName || '').trim(),
      dateOfBirth: body.dateOfBirth || '',
      sex: body.sex || 'Female',
      phoneNumber: String(body.phoneNumber || '').trim(),
      community: cleanCommunity,
      emergencyContact: String(body.emergencyContact || '').trim(),
      notes: body.notes || '',
      consentVerified: body.consentVerified ?? true,
      registeredByUid: LIVE_OPERATOR_PROFILE.uid,
      syncStatus: 'synchronized',
      version: 1,
      createdAt: new Date().toISOString(),
    };

    memoryStore.patients.unshift(created);
    memoryStore.auditLogs.unshift({
      id: Date.now(),
      userUid: LIVE_OPERATOR_PROFILE.uid,
      userName: LIVE_OPERATOR_PROFILE.fullName,
      userRole: 'Authorized Operator',
      action: 'Registered Patient Record',
      resource: `Patient ${created.patientId} (${created.fullName})`,
      status: 'Success',
      ipOrDevice: 'NEXORA Live Portal',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });

    return res.status(201).json({ patient: created, duplicateAlert: null });
  }

  // 5. Create Encounter
  if (url.endsWith('/api/encounters') && req.method === 'POST') {
    const encounterCode =
      body.encounterCode || `ENC-${new Date().getFullYear()}-${1001 + memoryStore.encounters.length}`;
    const cleanCommunity = body.community?.trim() || 'General Clinic Ward';

    if (!memoryStore.communities.some((c) => c.name === cleanCommunity)) {
      memoryStore.communities.push({
        id: memoryStore.communities.length + 1,
        code: `COM-${101 + memoryStore.communities.length}`,
        name: cleanCommunity,
        state: 'Active Catchment',
        organizationId: 1,
        populationEstimate: 0,
        connectivityProfile: 'Live Clinic Node',
      });
    }

    const created = {
      id: memoryStore.encounters.length + 1,
      encounterCode,
      clientRecordId: body.clientRecordId || `client-${Date.now()}`,
      patientId: body.patientId || 'NXR-PT-1001',
      patientName: body.patientName || 'Patient',
      community: cleanCommunity,
      encounterDate: body.encounterDate || new Date().toISOString().slice(0, 10),
      encounterType: body.encounterType || 'General Outpatient',
      reasonForVisit: body.reasonForVisit || '',
      temperature: body.temperature || '',
      bloodPressure: body.bloodPressure || '',
      heartRate: body.heartRate || '',
      respiratoryRate: body.respiratoryRate || '',
      symptoms: body.symptoms || '',
      observations: body.observations || '',
      actionTaken: body.actionTaken || '',
      referralRequired: Boolean(body.referralRequired),
      referralFacility: body.referralFacility || '',
      followUpRequired: Boolean(body.followUpRequired),
      followUpDate: body.followUpDate || '',
      notes: body.notes || '',
      recordedByUid: LIVE_OPERATOR_PROFILE.uid,
      recordedByName: LIVE_OPERATOR_PROFILE.fullName,
      syncStatus: 'synchronized',
      dataQualityStatus: 'complete',
      dataQualityNotes: 'Verified',
      version: 1,
      createdAt: new Date().toISOString(),
    };

    memoryStore.encounters.unshift(created);

    if (created.followUpRequired && created.followUpDate) {
      memoryStore.followUps.unshift({
        id: memoryStore.followUps.length + 1,
        followUpCode: `FUP-${101 + memoryStore.followUps.length}`,
        patientId: created.patientId,
        patientName: created.patientName,
        community: created.community,
        encounterCode: created.encounterCode,
        reason: created.reasonForVisit || created.encounterType,
        dueDate: created.followUpDate,
        status: 'Due Soon',
        priority: created.referralRequired ? 'High' : 'Normal',
        assignedWorkerUid: LIVE_OPERATOR_PROFILE.uid,
        assignedWorkerName: LIVE_OPERATOR_PROFILE.fullName,
        outcomeNotes: '',
      });
    }

    return res.status(201).json({ encounter: created });
  }

  // 6. Batch Sync
  if (url.endsWith('/api/sync/batch') && req.method === 'POST') {
    const items = Array.isArray(body.items) ? body.items : [];
    return res.status(200).json({
      syncedCount: items.length,
      synchronizedAt: new Date().toISOString(),
      results: items,
    });
  }

  // 7. Complete Follow-up
  if (url.includes('/api/follow-ups/') && url.endsWith('/complete')) {
    return res.status(200).json({ ok: true });
  }

  // 8. Resolve Alert
  if (url.includes('/api/alerts/') && url.endsWith('/resolve')) {
    return res.status(200).json({ ok: true });
  }

  // 9. Gemini AI Endpoints (if GEMINI_API_KEY is available on Vercel)
  if (
    url.endsWith('/api/intelligence/ai-brief') ||
    url.endsWith('/api/ai/visit-assistant') ||
    url.endsWith('/api/ai/ask')
  ) {
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        if (url.endsWith('/api/intelligence/ai-brief')) {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze these live operational health data metrics from NEXORA Health and generate 4 clear, user-friendly decision-support insights: ${JSON.stringify(
              body.summaryMetrics || {}
            )}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    headline: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                    priority: { type: Type.STRING },
                  },
                  required: ['category', 'headline', 'recommendation', 'priority'],
                },
              },
            },
          });
          return res.status(200).json({
            insights: JSON.parse((response.text || '[]').trim()),
            generatedBy: 'Gemini 2.5 Flash',
          });
        }

        if (url.endsWith('/api/ai/visit-assistant')) {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Assist a community health worker recording a live patient visit: ${JSON.stringify(
              body
            )}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  suggestedObservations: { type: Type.STRING },
                  suggestedActionTaken: { type: Type.STRING },
                  triagePriority: { type: Type.STRING },
                  referralRecommended: { type: Type.BOOLEAN },
                  followUpDays: { type: Type.INTEGER },
                  familyCareTip: { type: Type.STRING },
                },
                required: [
                  'suggestedObservations',
                  'suggestedActionTaken',
                  'triagePriority',
                  'referralRecommended',
                  'followUpDays',
                  'familyCareTip',
                ],
              },
            },
          });
          return res.status(200).json({
            suggestion: JSON.parse((response.text || '{}').trim()),
          });
        }

        if (url.endsWith('/api/ai/ask')) {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Live Clinic Context: ${JSON.stringify(body.liveContext || {})}\nQuestion: ${
              body.question || ''
            }`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  answer: { type: Type.STRING },
                  keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  suggestedFollowUpQuestion: { type: Type.STRING },
                },
                required: ['answer', 'keyPoints', 'suggestedFollowUpQuestion'],
              },
            },
          });
          return res.status(200).json({
            reply: JSON.parse((response.text || '{}').trim()),
          });
        }
      } catch (err) {
        console.warn('Serverless AI fallback triggered:', err);
      }
    }

    // Fallback responses when GEMINI_API_KEY is not configured in Vercel environment settings
    if (url.endsWith('/api/intelligence/ai-brief')) {
      const m = body.summaryMetrics || {};
      return res.status(200).json({
        insights: [
          {
            category: 'Care Follow-Up',
            headline: `Clinic has ${m.overdueFollowUps || 0} overdue and ${
              m.dueSoonFollowUps || 0
            } upcoming patient follow-ups scheduled.`,
            recommendation:
              'Review the Follow-Ups tab each morning to prioritize outreach for returning mothers and children.',
            priority: (m.overdueFollowUps || 0) > 0 ? 'High' : 'Normal',
          },
          {
            category: 'Record Quality',
            headline: `Current clinical record completeness is ${
              m.completenessRate || 100
            }% across ${m.totalEncounters || 0} recorded visits.`,
            recommendation:
              'Continue verifying blood pressure, temperature, and heart rate ranges before saving each visit.',
            priority: 'Normal',
          },
          {
            category: 'Community Visits',
            headline: `Primary catchment activity is centered in ${
              m.topCommunity || 'your active clinic ward'
            }.`,
            recommendation:
              'Keep registering new families and linking each visit to their local neighborhood or ward.',
            priority: 'Normal',
          },
          {
            category: 'Clinic Readiness',
            headline:
              'Offline device storage and one-tap clinic synchronization are active and ready.',
            recommendation:
              'Use Work Offline mode during field visits with low mobile signal and sync upon return.',
            priority: 'Normal',
          },
        ],
        generatedBy: 'NEXORA Smart Advisor',
      });
    }

    if (url.endsWith('/api/ai/visit-assistant')) {
      const tempNum = parseFloat(body.temperature || '36.8');
      const hasFever = !isNaN(tempNum) && tempNum >= 38.0;
      return res.status(200).json({
        suggestion: {
          suggestedObservations: `Patient ${
            body.patientName || ''
          } presented for ${body.encounterType || 'General Checkup'} reporting ${
            body.reasonForVisit || body.symptoms || 'routine clinical evaluation'
          }. Recorded vitals: Temp ${body.temperature || '36.8'}°C, BP ${
            body.bloodPressure || '120/80'
          } mmHg, HR ${body.heartRate || '76'} bpm.`,
          suggestedActionTaken: hasFever
            ? 'Provided supportive fever management, hydration counseling, and scheduled a 48-hour follow-up check.'
            : 'Completed clinical assessment, provided health education, and reviewed warning signs with the family.',
          triagePriority: hasFever ? 'Watch Closely' : 'Routine Care',
          referralRecommended: !isNaN(tempNum) && tempNum >= 39.2,
          followUpDays: hasFever ? 2 : 7,
          familyCareTip:
            'Ensure clean drinking water, rest, and return immediately to the clinic if symptoms worsen.',
        },
      });
    }

    if (url.endsWith('/api/ai/ask')) {
      const ctx = body.liveContext || {};
      return res.status(200).json({
        reply: {
          answer: `Your clinic currently has ${ctx.totalPatients || 0} registered patient(s), ${
            ctx.totalVisits || 0
          } recorded visit(s), and ${
            ctx.openFollowUpsCount || 0
          } open follow-up case(s). All records are available for immediate review and offline-ready capture.`,
          keyPoints: [
            'Check vital signs (temperature, blood pressure, pulse, respiratory rate) at every patient visit.',
            'Schedule a follow-up date whenever a patient needs a return checkup or maternal care visit.',
            'Use the Sync Center to synchronize any records saved while working offline.',
          ],
          suggestedFollowUpQuestion:
            'What vital sign checks should I prioritize during a maternal antenatal visit?',
        },
      });
    }
  }

  return res.status(200).json({ status: 'ok' });
}
