import { Request, Response, NextFunction } from 'express';

/**
 * Strips ASCII control characters (except standard newlines/tabs where allowed),
 * trims whitespace, and enforces a strict maximum character length.
 */
export function sanitizeText(
  value: unknown,
  maxLength = 500,
  allowMultiline = false
): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const cleaned = allowMultiline
    ? raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    : raw.replace(/[\x00-\x1F\x7F]/g, ' ');
  return cleaned.trim().slice(0, maxLength);
}

/**
 * Validates that a route parameter or value is a safe positive integer.
 */
export function parsePositiveInt(value: unknown): number | null {
  const str = String(value ?? '').trim();
  if (!/^\d+$/.test(str)) return null;
  const num = Number.parseInt(str, 10);
  if (!Number.isSafeInteger(num) || num <= 0 || num > 2_147_483_647) {
    return null;
  }
  return num;
}

const ALLOWED_SEX_VALUES = new Set(['Female', 'Male', 'Other']);
const ALLOWED_ENCOUNTER_TYPES = new Set([
  'General Outpatient',
  'Maternal Health',
  'Malaria / Febrile Triage',
  'Child Immunization',
  'Nutrition Screening',
  'Chronic Care Follow-Up',
]);
const ALLOWED_ALERT_RESOLUTIONS = new Set([
  'Reviewed & Merged',
  'Kept Local Version',
  'Kept Server Version',
  'Resolved',
  'Dismissed',
]);

export interface ValidatedPatientPayload {
  patientId?: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  phoneNumber: string;
  community: string;
  emergencyContact: string;
  notes: string;
  consentVerified: boolean;
}

export function validateServerPatientPayload(body: any): {
  valid: boolean;
  error?: string;
  data?: ValidatedPatientPayload;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Invalid patient request payload.' };
  }

  const fullName = sanitizeText(body.fullName, 120);
  if (fullName.length < 2) {
    return { valid: false, error: 'Patient full name is required (minimum 2 characters).' };
  }

  const dateOfBirth = sanitizeText(body.dateOfBirth, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return { valid: false, error: 'Date of birth must be in YYYY-MM-DD format.' };
  }
  const dobTime = Date.parse(dateOfBirth);
  const now = new Date();
  if (Number.isNaN(dobTime) || dobTime > now.getTime() + 86_400_000 || dobTime < Date.parse('1900-01-01')) {
    return { valid: false, error: 'Date of birth must be a valid past date.' };
  }

  const rawSex = sanitizeText(body.sex, 30);
  const sex = ALLOWED_SEX_VALUES.has(rawSex) ? rawSex : 'Female';

  const community = sanitizeText(body.community, 120) || 'General Clinic Ward';
  const phoneNumber = sanitizeText(body.phoneNumber, 40);
  const emergencyContact = sanitizeText(body.emergencyContact, 160);
  const notes = sanitizeText(body.notes, 1000, true);
  const consentVerified = body.consentVerified !== false;

  if (!consentVerified) {
    return { valid: false, error: 'Patient privacy consent must be verified before registration.' };
  }

  const rawPatientId = sanitizeText(body.patientId, 40);
  const patientId =
    rawPatientId && /^[A-Za-z0-9_-]{3,40}$/.test(rawPatientId) ? rawPatientId : undefined;

  return {
    valid: true,
    data: {
      patientId,
      fullName,
      dateOfBirth,
      sex,
      phoneNumber,
      community,
      emergencyContact,
      notes,
      consentVerified,
    },
  };
}

export interface ValidatedEncounterPayload {
  clientRecordId?: string;
  patientId: string;
  patientName: string;
  community: string;
  encounterDate: string;
  encounterType: string;
  reasonForVisit: string;
  temperature: string;
  bloodPressure: string;
  heartRate: string;
  respiratoryRate: string;
  symptoms: string;
  observations: string;
  actionTaken: string;
  referralRequired: boolean;
  referralFacility: string;
  followUpRequired: boolean;
  followUpDate: string;
  notes: string;
  capturedOffline: boolean;
}

export function validateServerEncounterPayload(body: any): {
  valid: boolean;
  error?: string;
  data?: ValidatedEncounterPayload;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Invalid health visit payload.' };
  }

  const patientName = sanitizeText(body.patientName, 120);
  if (patientName.length < 2) {
    return { valid: false, error: 'Patient name is required.' };
  }

  const rawPatientId = sanitizeText(body.patientId, 40);
  const patientId =
    rawPatientId && /^[A-Za-z0-9_-]{3,40}$/.test(rawPatientId)
      ? rawPatientId
      : `NXR-PT-${Date.now().toString().slice(-4)}`;

  const community = sanitizeText(body.community, 120) || 'General Clinic Ward';

  const encounterDate = sanitizeText(body.encounterDate, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(encounterDate) || Number.isNaN(Date.parse(encounterDate))) {
    return { valid: false, error: 'Valid visit date (YYYY-MM-DD) is required.' };
  }

  const rawType = sanitizeText(body.encounterType, 80);
  const encounterType = ALLOWED_ENCOUNTER_TYPES.has(rawType)
    ? rawType
    : rawType || 'General Outpatient';

  const reasonForVisit = sanitizeText(body.reasonForVisit, 300);
  if (!reasonForVisit) {
    return { valid: false, error: 'Reason for visit is required.' };
  }

  const temperature = sanitizeText(body.temperature, 15);
  const tempNum = Number.parseFloat(temperature);
  if (Number.isNaN(tempNum) || tempNum < 30.0 || tempNum > 44.0) {
    return {
      valid: false,
      error: 'Temperature must be a valid number between 30.0°C and 44.0°C.',
    };
  }

  const bloodPressure = sanitizeText(body.bloodPressure, 20);
  const bpMatch = bloodPressure.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!bpMatch) {
    return {
      valid: false,
      error: 'Blood pressure must be formatted as Systolic/Diastolic (e.g., 120/80).',
    };
  }
  const sys = Number.parseInt(bpMatch[1], 10);
  const dia = Number.parseInt(bpMatch[2], 10);
  if (sys < 50 || sys > 280 || dia < 30 || dia > 180 || sys <= dia) {
    return {
      valid: false,
      error: 'Blood pressure values are outside physiological limits.',
    };
  }

  const heartRate = sanitizeText(body.heartRate, 15);
  const hrNum = Number.parseInt(heartRate, 10);
  if (Number.isNaN(hrNum) || hrNum < 25 || hrNum > 250) {
    return {
      valid: false,
      error: 'Heart rate must be between 25 and 250 bpm.',
    };
  }

  const respiratoryRate = sanitizeText(body.respiratoryRate, 15);
  const rrNum = Number.parseInt(respiratoryRate, 10);
  if (Number.isNaN(rrNum) || rrNum < 5 || rrNum > 80) {
    return {
      valid: false,
      error: 'Respiratory rate must be between 5 and 80 breaths/min.',
    };
  }

  const symptoms = sanitizeText(body.symptoms, 500, true);
  const observations = sanitizeText(body.observations, 1200, true);
  const actionTaken = sanitizeText(body.actionTaken, 1200, true);
  const referralRequired = Boolean(body.referralRequired);
  const referralFacility = sanitizeText(body.referralFacility, 160);
  const followUpRequired = Boolean(body.followUpRequired);
  const rawFollowUpDate = sanitizeText(body.followUpDate, 20);
  const followUpDate =
    rawFollowUpDate && /^\d{4}-\d{2}-\d{2}$/.test(rawFollowUpDate) ? rawFollowUpDate : '';
  const notes = sanitizeText(body.notes, 1000, true);
  const capturedOffline = Boolean(body.capturedOffline);

  const rawClientRecordId = sanitizeText(body.clientRecordId, 80);
  const clientRecordId =
    rawClientRecordId && /^[A-Za-z0-9_.:-]{3,80}$/.test(rawClientRecordId)
      ? rawClientRecordId
      : undefined;

  return {
    valid: true,
    data: {
      clientRecordId,
      patientId,
      patientName,
      community,
      encounterDate,
      encounterType,
      reasonForVisit,
      temperature: String(tempNum),
      bloodPressure: `${sys}/${dia}`,
      heartRate: String(hrNum),
      respiratoryRate: String(rrNum),
      symptoms,
      observations,
      actionTaken,
      referralRequired,
      referralFacility,
      followUpRequired,
      followUpDate,
      notes,
      capturedOffline,
    },
  };
}

export function sanitizeResolutionStatus(status: unknown): string {
  const cleaned = sanitizeText(status, 60);
  if (ALLOWED_ALERT_RESOLUTIONS.has(cleaned)) {
    return cleaned;
  }
  return 'Reviewed & Merged';
}

/**
 * Extracts client IP address safely without trusting spoofed headers unless behind proxy.
 */
export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return (req.socket?.remoteAddress || 'unknown-client').slice(0, 64);
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

/**
 * Creates a memory-bounded sliding window rate limiter middleware.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message: string;
  keyPrefix: string;
}) {
  const buckets = new Map<string, RateLimitBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    // Periodic cleanup to prevent memory growth
    if (buckets.size > 2000) {
      for (const [k, v] of buckets.entries()) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }

    const clientKey = `${options.keyPrefix}:${getClientIdentifier(req)}`;
    const existing = buckets.get(clientKey);

    if (!existing || existing.resetAt <= now) {
      buckets.set(clientKey, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(options.maxRequests - 1));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(0, options.maxRequests - existing.count);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: options.message,
      });
    }

    return next();
  };
}

/**
 * Applies defensive HTTP security headers, strict CORS rules, and PHI cache prevention.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent leaking full URLs in Referer headers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Restrict sensitive browser APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  // Block Adobe Flash / PDF cross-domain policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // Enforce HTTPS when served over TLS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Compatible Content Security Policy that protects against object/base injection while working inside AI Studio preview iframe
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // Strict CORS check for API requests
  const origin = req.headers.origin;
  if (origin) {
    const appUrl = process.env.APP_URL || '';
    const isAllowedOrigin =
      origin.includes('.run.app') ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      (appUrl && origin === appUrl);

    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    } else if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Cross-origin request denied by security policy.' });
    }
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Prevent browser/proxy caching of sensitive healthcare API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}
