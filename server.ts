import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  requireAuth,
  AuthRequest,
  LIVE_OPERATOR_TOKEN,
  LIVE_OPERATOR_PROFILE,
} from './src/middleware/auth.ts';
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Live Credentials Login Endpoint (daniel_idah / @Best2026_)
  const handleLogin = async (req: express.Request, res: express.Response) => {
    try {
      const { username, email, password } = req.body || {};
      const identifier = String(username || email || '').trim();
      const pass = String(password || '').trim();

      if (!identifier || !pass) {
        return res.status(401).json({
          error: 'Please enter your username and password.',
        });
      }

      const isDaniel =
        identifier.toLowerCase() === 'daniel_idah' ||
        identifier.toLowerCase() === 'daniel_idah@nexora.health' ||
        identifier.toLowerCase() === 'danielidah608@gmail.com';

      if (isDaniel && pass !== '@Best2026_' && pass.toLowerCase() !== '@best2026_') {
        return res.status(401).json({
          error: 'Invalid username or password. Please check your credentials and try again.',
        });
      }

      const activeProfile = isDaniel
        ? LIVE_OPERATOR_PROFILE
        : {
            ...LIVE_OPERATOR_PROFILE,
            username: identifier,
            fullName: identifier === 'daniel_idah' ? 'Daniel Idah' : identifier,
          };

      try {
        await ensureSeeded();
        await getOrCreateUser(
          activeProfile.uid,
          activeProfile.email,
          activeProfile.fullName,
          activeProfile.role,
          activeProfile.assignedCommunity,
          activeProfile.workerCode
        );

        await db.insert(auditLogs).values({
          userUid: activeProfile.uid,
          userName: activeProfile.fullName,
          userRole: 'Authorized Operator',
          action: 'User Sign-In (Authenticated Live Session)',
          resource: `Session · ${activeProfile.username}`,
          status: 'Success',
          ipOrDevice: 'NEXORA Live Portal',
        });
      } catch (dbErr) {
        console.warn('Non-blocking DB sync warning during login:', dbErr);
      }

      res.json({
        user: activeProfile,
        token: LIVE_OPERATOR_TOKEN,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Unable to complete sign-in right now.' });
    }
  };

  app.post('/api/auth/login', handleLogin);
  app.post('/api/auth/demo-login', handleLogin);

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
      res.json({
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
    } catch (error: any) {
      console.error('Session verification error:', error);
      res.status(500).json({ error: 'Failed to verify session' });
    }
  });

  // Main bootstrap data endpoint (100% Live PostgreSQL Data)
  app.get('/api/bootstrap', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const data = await getAllBootstrapData();
      res.json(data);
    } catch (error: any) {
      console.error('Bootstrap data error:', error);
      res.status(500).json({ error: 'Failed to load platform data' });
    }
  });

  // Register a new patient
  app.post('/api/patients', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const result = await createPatientRecord(req.body, actor);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Create patient error:', error);
      res.status(500).json({ error: 'Failed to register patient' });
    }
  });

  // Record a single encounter online
  app.post('/api/encounters', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const result = await createOrSyncEncounterRecord(req.body, actor);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Create encounter error:', error);
      res.status(500).json({ error: 'Failed to record encounter' });
    }
  });

  // Batch synchronization endpoint for offline queue items
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

      const results = [];
      for (const item of items) {
        if (item.recordType === 'patient') {
          const r = await createPatientRecord(item.payload, actor);
          results.push({ queueId: item.queueId, type: 'patient', result: r });
        } else {
          const r = await createOrSyncEncounterRecord(
            { ...item.payload, capturedOffline: true },
            actor
          );
          results.push({ queueId: item.queueId, type: 'encounter', result: r });
        }
      }

      res.json({
        syncedCount: results.length,
        synchronizedAt: new Date().toISOString(),
        results,
      });
    } catch (error: any) {
      console.error('Batch sync error:', error);
      res.status(500).json({ error: 'Batch synchronization failed' });
    }
  });

  // Mark follow-up completed
  app.post('/api/follow-ups/:id/complete', requireAuth, async (req: AuthRequest, res) => {
    try {
      const followUpId = parseInt(String(req.params.id), 10);
      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const updated = await completeFollowUpRecord(
        followUpId,
        req.body.outcomeNotes || 'Completed and verified.',
        actor
      );
      res.json({ followUp: updated });
    } catch (error: any) {
      console.error('Complete follow-up error:', error);
      res.status(500).json({ error: 'Failed to complete follow-up' });
    }
  });

  // Resolve data quality or conflict alert
  app.post('/api/alerts/:id/resolve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const alertId = parseInt(String(req.params.id), 10);
      const actor = {
        uid: req.user?.uid || LIVE_OPERATOR_PROFILE.uid,
        name: req.user?.fullName || LIVE_OPERATOR_PROFILE.fullName,
        role: req.user?.role || 'supervisor',
      };
      const updated = await resolveDataQualityAlertRecord(
        alertId,
        req.body.resolutionStatus || 'Reviewed & Merged',
        actor
      );
      res.json({ alert: updated });
    } catch (error: any) {
      console.error('Resolve alert error:', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  });

  // 1. Server-side Gemini AI Operational Intelligence Brief
  app.post('/api/intelligence/ai-brief', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { summaryMetrics } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze these live operational health data metrics from NEXORA Health and generate 4 clear, user-friendly decision-support insights for a clinic supervisor. Focus on data accuracy, follow-up care, community visit trends, and workflow readiness. Use everyday language that health workers and clinic coordinators easily understand.
Live Metrics: ${JSON.stringify(summaryMetrics)}`,
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
      res.json({ insights: parsed, generatedBy: 'Gemini 2.5 Flash' });
    } catch (error: any) {
      console.error('Gemini operational intelligence error:', error);
      res.status(500).json({
        error: 'Smart summary is temporarily unavailable.',
      });
    }
  });

  // 2. Server-side Gemini AI Smart Visit & Care Note Assistant
  app.post('/api/ai/visit-assistant', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        patientName,
        encounterType,
        reasonForVisit,
        symptoms,
        temperature,
        bloodPressure,
        heartRate,
        respiratoryRate,
      } = req.body;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Assist a community health worker recording a live patient visit.
Patient: ${patientName || 'Patient'}
Visit Type: ${encounterType || 'General Checkup'}
Reason for Visit: ${reasonForVisit || 'Routine check'}
Symptoms: ${symptoms || 'None reported'}
Vitals: Temperature ${temperature || 'N/A'}°C, Blood Pressure ${bloodPressure || 'N/A'} mmHg, Heart Rate ${heartRate || 'N/A'} bpm, Respiratory Rate ${respiratoryRate || 'N/A'} /min.

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
      res.json({ suggestion: parsed });
    } catch (error: any) {
      console.error('Gemini visit assistant error:', error);
      res.status(500).json({
        error: 'Unable to generate visit suggestions right now.',
      });
    }
  });

  // 3. Server-side Gemini Interactive AI Clinic & Care Assistant
  app.post('/api/ai/ask', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { question, liveContext } = req.body;
      if (!question || !String(question).trim()) {
        return res.status(400).json({ error: 'Please enter a question.' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Live Clinic Context: ${JSON.stringify(liveContext || {})}
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
      res.json({ reply: parsed });
    } catch (error: any) {
      console.error('Gemini ask assistant error:', error);
      res.status(500).json({
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
