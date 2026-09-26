import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
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

  // Demo credentials login endpoint for worker@nexora.health and supervisor@nexora.health
  app.post('/api/auth/demo-login', async (req, res) => {
    try {
      const { email, password, role } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();

      if (password !== 'Demo123!') {
        return res.status(401).json({
          error: 'Invalid credentials. Use Demo123! for hackathon demo accounts.',
        });
      }

      const isSupervisor =
        role === 'supervisor' || cleanEmail === 'supervisor@nexora.health';

      const profile = isSupervisor
        ? {
            token: 'nexora-demo-supervisor',
            uid: 'demo-supervisor-uid-001',
            email: 'supervisor@nexora.health',
            fullName: 'Dr. Tunde Okonkwo',
            role: 'supervisor' as const,
            workerCode: 'SUP-002',
            assignedCommunity: 'Kano & Kaduna Catchment Zone',
          }
        : {
            token: 'nexora-demo-worker',
            uid: 'demo-worker-uid-001',
            email: 'worker@nexora.health',
            fullName: 'Amina Bello (CHW)',
            role: 'worker' as const,
            workerCode: 'CHW-014',
            assignedCommunity: 'Ungogo Ward A',
          };

      await ensureSeeded();
      await getOrCreateUser(
        profile.uid,
        profile.email,
        profile.fullName,
        profile.role,
        profile.assignedCommunity,
        profile.workerCode
      );

      await db.insert(auditLogs).values({
        userUid: profile.uid,
        userName: profile.fullName,
        userRole: profile.role === 'supervisor' ? 'Supervisor' : 'Frontline Worker',
        action: 'User Login (Authenticated Session)',
        resource: `Session · ${profile.email}`,
        status: 'Success',
        ipOrDevice: profile.role === 'supervisor' ? 'Supervisor Console' : 'PWA Field Device',
      });

      res.json({ user: profile, token: profile.token });
    } catch (error: any) {
      console.error('Demo login error:', error);
      res.status(500).json({ error: error.message || 'Authentication failed' });
    }
  });

  // Verify Firebase or Demo session and sync user with PostgreSQL
  app.get('/api/auth/session', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await ensureSeeded();
      const dbUser = await getOrCreateUser(
        req.user.uid,
        req.user.email || 'worker@nexora.health',
        req.user.fullName || 'Frontline Worker',
        req.user.role || 'worker',
        req.user.assignedCommunity || 'Ungogo Ward A',
        req.user.workerCode || 'CHW-014'
      );
      res.json({
        user: {
          uid: dbUser.uid,
          email: dbUser.email,
          fullName: dbUser.fullName,
          role: (req.user.role || dbUser.role) as 'worker' | 'supervisor',
          workerCode: dbUser.workerCode,
          assignedCommunity: dbUser.assignedCommunity,
        },
      });
    } catch (error: any) {
      console.error('Session verification error:', error);
      res.status(500).json({ error: error.message || 'Failed to verify session' });
    }
  });

  // Main bootstrap data endpoint
  app.get('/api/bootstrap', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getAllBootstrapData();
      res.json(data);
    } catch (error: any) {
      console.error('Bootstrap data error:', error);
      res.status(500).json({ error: error.message || 'Failed to load platform data' });
    }
  });

  // Register a new patient
  app.post('/api/patients', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = {
        uid: req.user?.uid || 'demo-worker-uid-001',
        name: req.user?.fullName || 'Amina Bello (CHW)',
        role: req.user?.role || 'worker',
      };
      const result = await createPatientRecord(req.body, actor);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Create patient error:', error);
      res.status(500).json({ error: error.message || 'Failed to register patient' });
    }
  });

  // Record a single encounter online
  app.post('/api/encounters', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = {
        uid: req.user?.uid || 'demo-worker-uid-001',
        name: req.user?.fullName || 'Amina Bello (CHW)',
        role: req.user?.role || 'worker',
      };
      const result = await createOrSyncEncounterRecord(req.body, actor);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Create encounter error:', error);
      res.status(500).json({ error: error.message || 'Failed to record encounter' });
    }
  });

  // Batch synchronization endpoint for offline queue items
  app.post('/api/sync/batch', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = {
        uid: req.user?.uid || 'demo-worker-uid-001',
        name: req.user?.fullName || 'Amina Bello (CHW)',
        role: req.user?.role || 'worker',
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
      res.status(500).json({ error: error.message || 'Batch synchronization failed' });
    }
  });

  // Mark follow-up completed
  app.post('/api/follow-ups/:id/complete', requireAuth, async (req: AuthRequest, res) => {
    try {
      const followUpId = parseInt(String(req.params.id), 10);
      const actor = {
        uid: req.user?.uid || 'demo-supervisor-uid-001',
        name: req.user?.fullName || 'Dr. Tunde Okonkwo',
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
      res.status(500).json({ error: error.message || 'Failed to complete follow-up' });
    }
  });

  // Resolve data quality or conflict alert
  app.post('/api/alerts/:id/resolve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const alertId = parseInt(String(req.params.id), 10);
      const actor = {
        uid: req.user?.uid || 'demo-supervisor-uid-001',
        name: req.user?.fullName || 'Dr. Tunde Okonkwo',
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
      res.status(500).json({ error: error.message || 'Failed to resolve alert' });
    }
  });

  // Server-side Gemini AI Operational Intelligence Brief
  app.post('/api/intelligence/ai-brief', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { summaryMetrics } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze these real-time operational health data metrics from NEXORA Health and generate 4 concise operational decision-support insights for a district healthcare supervisor. Focus strictly on data quality, synchronization reliability, community encounter trends, and follow-up completion. Do NOT generate medical diagnoses.
Metrics: ${JSON.stringify(summaryMetrics)}`,
        config: {
          systemInstruction:
            'You are the NEXORA Health Operational Decision Support Layer. Provide factual, non-diagnostic operational and data quality insights in valid JSON format.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description:
                    'Category of insight: Data Quality, Synchronization, Community Trend, or Follow-Up Operations',
                },
                headline: {
                  type: Type.STRING,
                  description: 'One-sentence quantitative operational insight',
                },
                recommendation: {
                  type: Type.STRING,
                  description: 'Concrete operational action for the supervisor',
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
      res.json({ insights: parsed, generatedBy: 'Gemini 3.8 Flash Operational Layer' });
    } catch (error: any) {
      console.error('Gemini operational intelligence error:', error);
      res.status(500).json({
        error:
          error.message ||
          'Failed to generate AI operational brief from Gemini service.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
