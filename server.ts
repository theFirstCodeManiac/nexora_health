import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  requireAuth,
  AuthRequest,
  LIVE_OPERATOR_PROFILE,
  verifyOperatorCredentials,
  issueOperatorSessionToken,
  revokeOperatorSessionToken,
} from './src/middleware/auth.ts';
import {
  securityHeadersMiddleware,
  createRateLimiter,
  sanitizeText,
  parsePositiveInt,
  validateServerPatientPayload,
  validateServerEncounterPayload,
  sanitizeResolutionStatus,
  getClientIdentifier,
} from './src/middleware/security.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  ensureSeeded,
  getAllBootstrapData,
  createPatientRecord,
  createOrSyncEncounterRecord,
  completeFollowUpRecord,
  resolveDataQualityAlertRecord,
} from './src/db/repository.ts';
import { db } from './src/db/index.ts';
import { auditLogs } from './src/db/schema.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'auth-login',
  message: 'Too many sign-in attempts. Please wait a few minutes before trying again.',
});

const aiRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 25,
  keyPrefix: 'ai-endpoint',
  message: 'AI assistant request rate limit reached. Please wait a moment and try again.',
});

const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 180,
  keyPrefix: 'general-api',
  message: 'Too many requests. Please slow down and try again shortly.',
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', apiRateLimiter);

  // Live Credentials Login Endpoint (daniel_idah / @Best2026_)
  app.post('/api/auth/login', loginRateLimiter, async (req: express.Request, res: express.Response) => {
    try {
      const rawUsername = sanitizeText(req.body?.username || req.body?.email, 80);
      const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!verifyOperatorCredentials(rawUsername, rawPassword)) {
        try {
          await ensureSeeded();
          await db.insert(auditLogs).values({
            userUid: 'unauthenticated',
            userName: rawUsername || 'Unknown User',
            userRole: 'Unauthenticated',
            action: 'Failed Sign-In Attempt',
            resource: 'Authentication Portal',
            status: 'Denied',
            ipOrDevice: getClientIdentifier(req),
          });
        } catch {
          // Ignore audit log error if DB is initializing
        }

        return res.status(401).json({
          error: 'Invalid username or password. Please check your credentials and try again.',
        });
      }

      await ensureSeeded();
      await getOrCreateUser(
        LIVE_OPERATOR_PROFILE.uid,
        LIVE_OPERATOR_PROFILE.email,
        LIVE_OPERATOR_PROFILE.fullName,
        LIVE_OPERATOR_PROFILE.role,
        LIVE_OPERATOR_PROFILE.assignedCommunity,
        LIVE_OPERATOR_PROFILE.workerCode
      );

      const { token, expiresAt } = issueOperatorSessionToken();

      await db.insert(auditLogs).values({
        userUid: LIVE_OPERATOR_PROFILE.uid,
        userName: LIVE_OPERATOR_PROFILE.fullName,
        userRole: 'Authorized Operator',
        action: 'User Sign-In (Authenticated Live Session)',
        resource: `Session · ${LIVE_OPERATOR_PROFILE.username}`,
        status: 'Success',
        ipOrDevice: getClientIdentifier(req),
      });

      return res.json({
        user: LIVE_OPERATOR_PROFILE,
        token,
        expiresAt,
      });
    } catch {
      return res.status(500).json({ error: 'Unable to complete sign-in right now.' });
    }
  });

  // Explicit Session Logout & Token Revocation Endpoint
  app.post('/api/auth/logout', requireAuth, async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      revokeOperatorSessionToken(token);

      await db.insert(auditLogs).values({
        userUid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        userName: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        userRole: 'Authorized Operator',
        action: 'User Sign-Out (Session Revoked)',
        resource: `Session · ${LIVE_OPERATOR_PROFILE.username}`,
        status: 'Success',
        ipOrDevice: getClientIdentifier(req),
      });

      return res.json({ loggedOut: true });
    } catch {
      return res.json({ loggedOut: true });
    }
  });

  // Verify session and sync user with PostgreSQL
  app.get('/api/auth/session', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await ensureSeeded();
      const dbUser = await getOrCreateUser(
        req.user.uid,
        req.user.email || LIVE_OPERATOR_PROFILE.email,
        req.user.fullName || LIVE_OPERATOR_PROFILE.fullName,
        'supervisor',
        req.user.assignedCommunity || LIVE_OPERATOR_PROFILE.assignedCommunity,
        req.user.workerCode || LIVE_OPERATOR_PROFILE.workerCode
      );
      return res.json({
        user: {
          uid: dbUser.uid,
          username: 'daniel_idah',
          email: dbUser.email,
          fullName: dbUser.fullName,
          role: 'supervisor',
          workerCode: dbUser.workerCode,
          assignedCommunity: dbUser.assignedCommunity,
        },
      });
    } catch {
      return res.status(500).json({ error: 'Failed to verify session' });
    }
  });

  // Main bootstrap data endpoint (100% Live PostgreSQL Data)
  app.get('/api/bootstrap', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const data = await getAllBootstrapData();
      return res.json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to load platform data' });
    }
  });

  // Register a new patient (with strict server-side validation)
  app.post('/api/patients', requireAuth, async (req: AuthRequest, res) => {
    try {
      const validation = validateServerPatientPayload(req.body);
      if (!validation.valid || !validation.data) {
        return res.status(400).json({ error: validation.error || 'Invalid patient details.' });
      }

      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const result = await createPatientRecord(validation.data, actor);
      return res.status(201).json(result);
    } catch {
      return res.status(500).json({ error: 'Failed to register patient' });
    }
  });

  // Record a single encounter online (with strict server-side validation)
  app.post('/api/encounters', requireAuth, async (req: AuthRequest, res) => {
    try {
      const validation = validateServerEncounterPayload(req.body);
      if (!validation.valid || !validation.data) {
        return res.status(400).json({ error: validation.error || 'Invalid health visit details.' });
      }

      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const result = await createOrSyncEncounterRecord(validation.data, actor);
      return res.status(201).json(result);
    } catch {
      return res.status(500).json({ error: 'Failed to record encounter' });
    }
  });

  // Batch synchronization endpoint for offline queue items (bounded & validated)
  app.post('/api/sync/batch', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const { items } = req.body as {
        items: Array<{
          queueId: string;
          recordType: 'encounter' | 'patient';
          payload: any;
        }>;
      };

      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ syncedCount: 0, results: [] });
      }
      if (items.length > 50) {
        return res.status(400).json({
          error: 'Batch synchronization exceeds maximum allowed size (50 records per batch).',
        });
      }

      const results = [];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const safeQueueId = sanitizeText(item.queueId, 80);

        if (item.recordType === 'patient') {
          const validatedPt = validateServerPatientPayload(item.payload);
          if (!validatedPt.valid || !validatedPt.data) continue;
          const r = await createPatientRecord(validatedPt.data, actor);
          results.push({ queueId: safeQueueId, type: 'patient', result: r });
        } else if (item.recordType === 'encounter') {
          const validatedEnc = validateServerEncounterPayload({
            ...item.payload,
            capturedOffline: true,
          });
          if (!validatedEnc.valid || !validatedEnc.data) continue;
          const r = await createOrSyncEncounterRecord(validatedEnc.data, actor);
          results.push({ queueId: safeQueueId, type: 'encounter', result: r });
        }
      }

      return res.json({
        syncedCount: results.length,
        synchronizedAt: new Date().toISOString(),
        results,
      });
    } catch {
      return res.status(500).json({ error: 'Batch synchronization failed' });
    }
  });

  // Mark follow-up completed
  app.post('/api/follow-ups/:id/complete', requireAuth, async (req: AuthRequest, res) => {
    try {
      const followUpId = parsePositiveInt(req.params.id);
      if (!followUpId) {
        return res.status(400).json({ error: 'Invalid follow-up record identifier.' });
      }

      const outcomeNotes =
        sanitizeText(req.body?.outcomeNotes, 500, true) || 'Completed and verified.';
      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const updated = await completeFollowUpRecord(followUpId, outcomeNotes, actor);
      if (!updated) {
        return res.status(404).json({ error: 'Follow-up record not found.' });
      }
      return res.json({ followUp: updated });
    } catch {
      return res.status(500).json({ error: 'Failed to complete follow-up' });
    }
  });

  // Resolve data quality or conflict alert
  app.post('/api/alerts/:id/resolve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const alertId = parsePositiveInt(req.params.id);
      if (!alertId) {
        return res.status(400).json({ error: 'Invalid alert identifier.' });
      }

      const resolutionStatus = sanitizeResolutionStatus(req.body?.resolutionStatus);
      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const updated = await resolveDataQualityAlertRecord(alertId, resolutionStatus, actor);
      if (!updated) {
        return res.status(404).json({ error: 'Alert record not found.' });
      }
      return res.json({ alert: updated });
    } catch {
      return res.status(500).json({ error: 'Failed to resolve alert' });
    }
  });

  // 1. Server-side Gemini AI Operational Intelligence Brief
  app.post(
    '/api/intelligence/ai-brief',
    requireAuth,
    aiRateLimiter,
    async (req: AuthRequest, res) => {
      try {
        const rawMetrics = req.body?.summaryMetrics || {};
        const safeMetricsJson = JSON.stringify(rawMetrics).slice(0, 4000);

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Analyze these live operational health data metrics from NEXORA Health and generate 4 clear, user-friendly decision-support insights for a clinic supervisor. Focus on data accuracy, follow-up care, community visit trends, and workflow readiness. Use everyday language that health workers and clinic coordinators easily understand.
Live Metrics: ${safeMetricsJson}`,
          config: {
            systemInstruction:
              'You are the NEXORA Health Smart Clinic Advisor. Provide helpful, clear, non-jargon operational insights in valid JSON format.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description:
                      'Category of insight: Care Follow-Up, Record Quality, Community Visits, or Clinic Readiness',
                  },
                  headline: {
                    type: Type.STRING,
                    description: 'One-sentence clear insight based on the live numbers',
                  },
                  recommendation: {
                    type: Type.STRING,
                    description: 'Practical next step for the clinic team',
                  },
                  priority: {
                    type: Type.STRING,
                    description: 'High, Medium, or Normal',
                  },
                },
                required: ['category', 'headline', 'recommendation', 'priority'],
              },
            },
          },
        });

        const text = response.text || '[]';
        const parsed = JSON.parse(text.trim());
        return res.json({ insights: parsed, generatedBy: 'Gemini 2.5 Flash' });
      } catch {
        return res.status(500).json({
          error: 'Smart summary is temporarily unavailable.',
        });
      }
    }
  );

  // 2. Server-side Gemini AI Smart Visit & Care Note Assistant
  app.post(
    '/api/ai/visit-assistant',
    requireAuth,
    aiRateLimiter,
    async (req: AuthRequest, res) => {
      try {
        const encounterType = sanitizeText(req.body?.encounterType, 80) || 'General Checkup';
        const reasonForVisit = sanitizeText(req.body?.reasonForVisit, 300) || 'Routine check';
        const symptoms = sanitizeText(req.body?.symptoms, 400) || 'None reported';
        const temperature = sanitizeText(req.body?.temperature, 15) || 'N/A';
        const bloodPressure = sanitizeText(req.body?.bloodPressure, 20) || 'N/A';
        const heartRate = sanitizeText(req.body?.heartRate, 15) || 'N/A';
        const respiratoryRate = sanitizeText(req.body?.respiratoryRate, 15) || 'N/A';

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Assist a community health worker recording a live patient visit.
Visit Type: ${encounterType}
Reason for Visit: ${reasonForVisit}
Symptoms: ${symptoms}
Vitals: Temperature ${temperature}°C, Blood Pressure ${bloodPressure} mmHg, Heart Rate ${heartRate} bpm, Respiratory Rate ${respiratoryRate} /min.

Provide a structured, plain-language care suggestion to help complete the visit form accurately.`,
          config: {
            systemInstruction:
              'You are a supportive primary healthcare assistant helping a nurse or community health worker write clear visit observations and care actions in simple, everyday language.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedObservations: {
                  type: Type.STRING,
                  description:
                    'Clear 1-2 sentence clinical observation note summarizing the vitals and presentation',
                },
                suggestedActionTaken: {
                  type: Type.STRING,
                  description:
                    'Clear 1-2 sentence supportive care action and counseling step',
                },
                triagePriority: {
                  type: Type.STRING,
                  description: 'Routine Care, Watch Closely, or Urgent Hospital Referral',
                },
                referralRecommended: {
                  type: Type.BOOLEAN,
                  description: 'True if vital signs or symptoms warrant hospital referral',
                },
                followUpDays: {
                  type: Type.INTEGER,
                  description: 'Recommended number of days until next follow-up check (e.g., 2, 7, 14)',
                },
                familyCareTip: {
                  type: Type.STRING,
                  description: 'One simple health tip to share verbally with the patient or family',
                },
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

        const text = response.text || '{}';
        const parsed = JSON.parse(text.trim());
        return res.json({ suggestion: parsed });
      } catch {
        return res.status(500).json({
          error: 'Unable to generate visit suggestions right now.',
        });
      }
    }
  );

  // 3. Server-side Gemini Interactive AI Clinic & Care Assistant
  app.post('/api/ai/ask', requireAuth, aiRateLimiter, async (req: AuthRequest, res) => {
    try {
      const question = sanitizeText(req.body?.question, 600);
      if (!question) {
        return res.status(400).json({ error: 'Please enter a question.' });
      }

      const safeContextJson = JSON.stringify(req.body?.liveContext || {}).slice(0, 6000);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Live Clinic Context: ${safeContextJson}
Operator Question: ${question}`,
        config: {
          systemInstruction:
            'You are the NEXORA Health AI Assistant. Answer questions from clinic staff clearly, warmly, and in plain, user-friendly language without technical jargon. Use the provided Live Clinic Context when answering questions about current patients, visits, or follow-ups.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: 'Clear, helpful response in plain language (2-4 sentences)',
              },
              keyPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-3 actionable bullet points or takeaways',
              },
              suggestedFollowUpQuestion: {
                type: Type.STRING,
                description: 'One relevant follow-up question the user might want to ask next',
              },
            },
            required: ['answer', 'keyPoints', 'suggestedFollowUpQuestion'],
          },
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text.trim());
      return res.json({ reply: parsed });
    } catch {
      return res.status(500).json({
        error: 'AI Assistant is temporarily unavailable.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXORA Health Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
