import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken & {
    role?: 'worker' | 'supervisor';
    fullName?: string;
    workerCode?: string;
    assignedCommunity?: string;
  };
}

const DEMO_ACCOUNTS: Record<
  string,
  {
    uid: string;
    email: string;
    role: 'worker' | 'supervisor';
    fullName: string;
    workerCode: string;
    assignedCommunity: string;
  }
> = {
  'nexora-demo-worker': {
    uid: 'demo-worker-uid-001',
    email: 'worker@nexora.health',
    role: 'worker',
    fullName: 'Amina Bello (CHW)',
    workerCode: 'CHW-014',
    assignedCommunity: 'Ungogo Ward A',
  },
  'nexora-demo-supervisor': {
    uid: 'demo-supervisor-uid-001',
    email: 'supervisor@nexora.health',
    role: 'supervisor',
    fullName: 'Dr. Tunde Okonkwo',
    workerCode: 'SUP-002',
    assignedCommunity: 'Kano & Kaduna District',
  },
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  const requestedRole = req.headers['x-nexora-role'] as 'worker' | 'supervisor' | undefined;

  if (token in DEMO_ACCOUNTS) {
    const demoAccount = DEMO_ACCOUNTS[token];
    const effectiveRole = requestedRole || demoAccount.role;
    req.user = {
      uid: demoAccount.uid,
      email: demoAccount.email,
      role: effectiveRole,
      fullName: demoAccount.fullName,
      workerCode: demoAccount.workerCode,
      assignedCommunity: demoAccount.assignedCommunity,
      aud: 'nexora-health',
      auth_time: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      iat: Math.floor(Date.now() / 1000),
      iss: 'nexora-health',
      sub: demoAccount.uid,
      firebase: { identities: {}, sign_in_provider: 'custom' },
    };
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const defaultRole =
      decodedToken.email === 'supervisor@nexora.health' ? 'supervisor' : 'worker';
    req.user = {
      ...decodedToken,
      role: requestedRole || defaultRole,
      fullName: decodedToken.name || decodedToken.email?.split('@')[0] || 'Frontline Operator',
      workerCode: (requestedRole || defaultRole) === 'supervisor' ? 'SUP-001' : 'CHW-019',
      assignedCommunity: 'Ungogo Ward A',
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
