import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken & {
    role?: 'worker' | 'supervisor';
    fullName?: string;
    workerCode?: string;
    assignedCommunity?: string;
    sessionJti?: string;
  };
}

export const LIVE_OPERATOR_PROFILE = {
  uid: 'user-daniel-idah',
  username: 'daniel_idah',
  email: 'daniel_idah@nexora.health',
  role: 'supervisor' as const,
  fullName: 'Daniel Idah',
  workerCode: 'OP-001',
  assignedCommunity: 'Primary Health Network',
};

// Ephemeral per-boot + environment cryptographic signing key (32+ bytes)
const SESSION_SIGNING_SECRET =
  process.env.NEXORA_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`nexora-hmac-key-${process.env.GEMINI_API_KEY || 'local'}-${process.env.SQL_PASSWORD || 'db'}`)
    .digest('hex');

const SCRYPT_SALT = 'nexora-auth-kdf-salt-v2';
const CONFIGURED_USERNAME = process.env.NEXORA_OPERATOR_USERNAME || 'daniel_idah';
const CONFIGURED_PASSWORD = process.env.NEXORA_OPERATOR_PASSWORD || '@Best2026_';

const EXPECTED_USER_KEY = crypto.scryptSync(CONFIGURED_USERNAME, SCRYPT_SALT, 32);
const EXPECTED_PASS_KEY = crypto.scryptSync(CONFIGURED_PASSWORD, SCRYPT_SALT, 32);

// Explicit allowlist of Google accounts permitted to access NEXORA Health
const AUTHORIZED_GOOGLE_EMAILS = new Set(
  [
    'danielidah608@gmail.com',
    'daniel_idah@nexora.health',
    ...(process.env.AUTHORIZED_OPERATOR_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ].map((e) => e.toLowerCase())
);

// Revoked session token JTIs (for immediate server-side logout invalidation)
const revokedSessionJtis = new Set<string>();

/**
 * Verifies operator username and password using scrypt key derivation
 * and constant-time comparison to prevent timing side-channel attacks.
 */
export function verifyOperatorCredentials(usernameInput: string, passwordInput: string): boolean {
  if (!usernameInput || !passwordInput) return false;
  if (usernameInput.length > 128 || passwordInput.length > 128) return false;

  try {
    const candidateUserKey = crypto.scryptSync(usernameInput.trim(), SCRYPT_SALT, 32);
    const candidatePassKey = crypto.scryptSync(passwordInput, SCRYPT_SALT, 32);

    const userMatch = crypto.timingSafeEqual(candidateUserKey, EXPECTED_USER_KEY);
    const passMatch = crypto.timingSafeEqual(candidatePassKey, EXPECTED_PASS_KEY);
    return userMatch && passMatch;
  } catch {
    return false;
  }
}

interface SignedSessionPayload {
  jti: string;
  uid: string;
  username: string;
  email: string;
  role: 'supervisor' | 'worker';
  fullName: string;
  workerCode: string;
  assignedCommunity: string;
  iat: number;
  exp: number;
}

/**
 * Issues a cryptographically signed, time-limited HMAC-SHA256 session token.
 */
export function issueOperatorSessionToken(ttlSeconds = 12 * 60 * 60): {
  token: string;
  expiresAt: number;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + ttlSeconds;
  const payload: SignedSessionPayload = {
    jti: crypto.randomBytes(16).toString('hex'),
    uid: LIVE_OPERATOR_PROFILE.uid,
    username: LIVE_OPERATOR_PROFILE.username,
    email: LIVE_OPERATOR_PROFILE.email,
    role: LIVE_OPERATOR_PROFILE.role,
    fullName: LIVE_OPERATOR_PROFILE.fullName,
    workerCode: LIVE_OPERATOR_PROFILE.workerCode,
    assignedCommunity: LIVE_OPERATOR_PROFILE.assignedCommunity,
    iat: nowSec,
    exp: expSec,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return {
    token: `nxr_v2.${payloadB64}.${signature}`,
    expiresAt: expSec * 1000,
  };
}

/**
 * Verifies a signed HMAC-SHA256 session token in constant time and checks expiration & revocation.
 */
export function verifyOperatorSessionToken(token: string): SignedSessionPayload | null {
  if (!token || !token.startsWith('nxr_v2.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [, payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SIGNING_SECRET)
      .update(payloadB64)
      .digest('base64url');

    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as SignedSessionPayload;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp <= nowSec) {
      return null;
    }
    if (!decoded.jti || revokedSessionJtis.has(decoded.jti)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Revokes a session token JTI so it can no longer be used.
 */
export function revokeOperatorSessionToken(token?: string): void {
  if (!token) return;
  const verified = verifyOperatorSessionToken(token);
  if (verified?.jti) {
    if (revokedSessionJtis.size > 5000) {
      revokedSessionJtis.clear();
    }
    revokedSessionJtis.add(verified.jti);
  }
}

export function isAuthorizedGoogleEmail(email?: string | null): boolean {
  if (!email) return false;
  return AUTHORIZED_GOOGLE_EMAILS.has(email.trim().toLowerCase());
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 4096) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }

  // 1. Verify cryptographically signed NEXORA operator session token
  const signedSession = verifyOperatorSessionToken(token);
  if (signedSession) {
    req.user = {
      uid: signedSession.uid,
      email: signedSession.email,
      role: signedSession.role,
      fullName: signedSession.fullName,
      workerCode: signedSession.workerCode,
      assignedCommunity: signedSession.assignedCommunity,
      sessionJti: signedSession.jti,
      aud: 'nexora-health',
      auth_time: signedSession.iat,
      exp: signedSession.exp,
      iat: signedSession.iat,
      iss: 'nexora-health',
      sub: signedSession.uid,
      firebase: { identities: {}, sign_in_provider: 'custom' },
    };
    return next();
  }

  // 2. Verify Firebase ID Token and enforce Authorized Operator Email Allowlist
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!isAuthorizedGoogleEmail(decodedToken.email)) {
      return res.status(403).json({
        error: 'Your account is not authorized to access this clinic workspace.',
      });
    }

    req.user = {
      ...decodedToken,
      role: 'supervisor',
      fullName: decodedToken.name || decodedToken.email?.split('@')[0] || 'Daniel Idah',
      workerCode: 'OP-001',
      assignedCommunity: 'Primary Health Network',
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
};
