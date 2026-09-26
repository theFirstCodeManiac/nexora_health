import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  organizations,
  communities,
  users,
  patients,
  encounters,
  followUps,
  syncQueue,
  dataQualityAlerts,
  auditLogs,
} from './schema.ts';

let isInitializing = false;
let hasInitialized = false;

/**
 * Ensures the core organization exists without inserting any mock or fictional records.
 */
export async function ensureSeeded() {
  if (hasInitialized || isInitializing) return;
  isInitializing = true;
  try {
    const existingOrgs = await db.select().from(organizations).limit(1);
    if (existingOrgs.length === 0) {
      await db
        .insert(organizations)
        .values({
          code: 'ORG-NGA-PHC-01',
          name: 'NEXORA Primary Health Network',
          region: 'Primary Care Operations',
          ndpaCompliantMode: true,
        })
        .onConflictDoNothing();
    }
    hasInitialized = true;
  } catch (error) {
    console.error('Organization init check error:', error);
  } finally {
    isInitializing = false;
  }
}

export async function getAllBootstrapData() {
  try {
    await ensureSeeded();
    const [
      orgRows,
      communityRows,
      userRows,
      patientRows,
      encounterRows,
      followUpRows,
      syncQueueRows,
      alertRows,
      auditRows,
    ] = await Promise.all([
      db.select().from(organizations),
      db.select().from(communities),
      db.select().from(users),
      db.select().from(patients).orderBy(desc(patients.id)),
      db.select().from(encounters).orderBy(desc(encounters.id)),
      db.select().from(followUps).orderBy(desc(followUps.id)),
      db.select().from(syncQueue).orderBy(desc(syncQueue.id)),
      db.select().from(dataQualityAlerts).orderBy(desc(dataQualityAlerts.id)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(100),
    ]);

    return {
      organizations: orgRows,
      communities: communityRows,
      workers: userRows,
      patients: patientRows,
      encounters: encounterRows,
      followUps: followUpRows,
      syncQueue: syncQueueRows,
      dataQualityAlerts: alertRows,
      auditLogs: auditRows,
    };
  } catch (error) {
    console.error('Database query failed in getAllBootstrapData:', error);
    throw new Error('Failed to load operational health data.', { cause: error });
  }
}

export async function createPatientRecord(
  payload: {
    patientId?: string;
    fullName: string;
    dateOfBirth: string;
    sex: string;
    phoneNumber: string;
    community: string;
    emergencyContact: string;
    notes?: string;
    consentVerified?: boolean;
  },
  actor: { uid: string; name: string; role: string }
) {
  try {
    await ensureSeeded();
    const existingPatients = await db.select().from(patients);
    const nextNum = 1001 + existingPatients.length;
    const generatedId = payload.patientId?.trim() || `NXR-PT-${nextNum}`;

    // If community is new, add it to communities table automatically so community lists reflect live data
    const cleanCommunity = payload.community?.trim() || 'General Clinic Ward';
    const existingComm = await db
      .select()
      .from(communities)
      .where(eq(communities.name, cleanCommunity))
      .limit(1);

    if (existingComm.length === 0) {
      await db
        .insert(communities)
        .values({
          code: `COM-${Date.now().toString().slice(-4)}`,
          name: cleanCommunity,
          state: 'Active Catchment',
          organizationId: 1,
          populationEstimate: 0,
          connectivityProfile: 'Live Clinic Node',
        })
        .onConflictDoNothing();
    }

    // Duplicate check by name + DOB or same patientId
    const duplicateCandidate = existingPatients.find(
      (p) =>
        p.patientId.toLowerCase() === generatedId.toLowerCase() ||
        (p.fullName.trim().toLowerCase() === payload.fullName.trim().toLowerCase() &&
          p.dateOfBirth === payload.dateOfBirth)
    );

    const [created] = await db
      .insert(patients)
      .values({
        patientId: generatedId,
        fullName: payload.fullName.trim(),
        dateOfBirth: payload.dateOfBirth,
        sex: payload.sex,
        phoneNumber: payload.phoneNumber.trim(),
        community: cleanCommunity,
        emergencyContact: payload.emergencyContact.trim(),
        notes: payload.notes || '',
        consentVerified: payload.consentVerified ?? true,
        registeredByUid: actor.uid,
        syncStatus: 'synchronized',
        version: 1,
      })
      .onConflictDoUpdate({
        target: patients.patientId,
        set: {
          phoneNumber: payload.phoneNumber.trim(),
          emergencyContact: payload.emergencyContact.trim(),
          notes: payload.notes || '',
        },
      })
      .returning();

    let createdAlert = null;
    if (duplicateCandidate) {
      const alertCode = `DQA-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`;
      const [alert] = await db
        .insert(dataQualityAlerts)
        .values({
          alertCode,
          alertType: 'Potential Duplicate',
          severity: 'High',
          patientId: created.patientId,
          patientName: created.fullName,
          encounterCode: '',
          matchingRecordCode: duplicateCandidate.patientId,
          description: `Potential duplicate patient registration detected: matches ${duplicateCandidate.fullName} (${duplicateCandidate.patientId}, DOB ${duplicateCandidate.dateOfBirth}) in ${duplicateCandidate.community}.`,
          localVersionJson: JSON.stringify(created),
          serverVersionJson: JSON.stringify(duplicateCandidate),
          status: 'Open',
        })
        .returning();
      createdAlert = alert;
    }

    await db.insert(auditLogs).values({
      userUid: actor.uid,
      userName: actor.name,
      userRole: 'Authorized Operator',
      action: 'Registered Patient Record',
      resource: `Patient ${created.patientId} (${created.fullName})`,
      status: duplicateCandidate ? 'Flagged Duplicate' : 'Success',
      ipOrDevice: 'NEXORA Live Portal',
    });

    return { patient: created, duplicateAlert: createdAlert };
  } catch (error) {
    console.error('Database query failed in createPatientRecord:', error);
    throw new Error('Failed to register patient record.', { cause: error });
  }
}

export async function createOrSyncEncounterRecord(
  payload: {
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
    referralFacility?: string;
    followUpRequired: boolean;
    followUpDate?: string;
    notes?: string;
    capturedOffline?: boolean;
  },
  actor: { uid: string; name: string; role: string }
) {
  try {
    await ensureSeeded();
    const allEncounters = await db.select().from(encounters);
    const clientRecId =
      payload.clientRecordId || `client-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const year = new Date().getFullYear();
    const encounterCode = `ENC-${year}-${1001 + allEncounters.length}`;

    // Server-side validation & duplicate detection
    const issues: string[] = [];
    const tempNum = parseFloat(payload.temperature);
    const hrNum = parseInt(payload.heartRate, 10);
    const rrNum = parseInt(payload.respiratoryRate, 10);

    if (isNaN(tempNum) || tempNum < 34 || tempNum > 42.5) {
      issues.push(`Temperature (${payload.temperature}°C) outside standard physiological range.`);
    }
    if (isNaN(hrNum) || hrNum < 35 || hrNum > 220) {
      issues.push(`Heart rate (${payload.heartRate} bpm) requires clinical verification.`);
    }
    if (isNaN(rrNum) || rrNum < 8 || rrNum > 65) {
      issues.push(`Respiratory rate (${payload.respiratoryRate} /min) outside standard range.`);
    }
    if (payload.followUpRequired && !payload.followUpDate?.trim()) {
      issues.push('Follow-up required is enabled, but target follow-up date is missing.');
    }
    if (!payload.observations?.trim() || !payload.actionTaken?.trim()) {
      issues.push('Clinical observations or action taken summary is incomplete.');
    }

    // Check duplicate encounter: same patientId + same encounterDate + same encounterType
    const duplicateMatch = allEncounters.find(
      (e) =>
        e.clientRecordId !== clientRecId &&
        e.patientId === payload.patientId &&
        e.encounterDate === payload.encounterDate &&
        e.encounterType === payload.encounterType
    );

    let dataQualityStatus = 'complete';
    if (duplicateMatch) {
      dataQualityStatus = 'duplicate_flagged';
      issues.push(
        `Potential duplicate of ${duplicateMatch.encounterCode} recorded on ${duplicateMatch.encounterDate}.`
      );
    } else if (issues.length > 0) {
      dataQualityStatus = 'needs_review';
    }

    const cleanCommunity = payload.community?.trim() || 'General Clinic Ward';

    const [inserted] = await db
      .insert(encounters)
      .values({
        encounterCode,
        clientRecordId: clientRecId,
        patientId: payload.patientId,
        patientName: payload.patientName,
        community: cleanCommunity,
        workerUid: actor.uid,
        workerName: actor.name,
        encounterDate: payload.encounterDate,
        encounterType: payload.encounterType,
        reasonForVisit: payload.reasonForVisit,
        temperature: payload.temperature,
        bloodPressure: payload.bloodPressure,
        heartRate: payload.heartRate,
        respiratoryRate: payload.respiratoryRate,
        symptoms: payload.symptoms || 'None reported',
        observations: payload.observations || 'Recorded during clinic visit.',
        actionTaken: payload.actionTaken || 'Standard care protocol applied.',
        referralRequired: Boolean(payload.referralRequired),
        referralFacility: payload.referralFacility || '',
        followUpRequired: Boolean(payload.followUpRequired),
        followUpDate: payload.followUpDate || '',
        notes: payload.notes || '',
        dataQualityStatus,
        validationNotes:
          issues.length > 0
            ? issues.join(' ')
            : 'Complete — passed automated range & completeness checks.',
        capturedOffline: Boolean(payload.capturedOffline),
        version: 1,
      })
      .onConflictDoUpdate({
        target: encounters.clientRecordId,
        set: {
          temperature: payload.temperature,
          bloodPressure: payload.bloodPressure,
          observations: payload.observations,
          actionTaken: payload.actionTaken,
          synchronizedAt: new Date(),
        },
      })
      .returning();

    // If followUpRequired, automatically create a follow_up entry
    let createdFollowUp = null;
    if (payload.followUpRequired) {
      const fupCode = `FUP-${year}-${Math.floor(100 + Math.random() * 899)}`;
      const todayIso = new Date().toISOString().slice(0, 10);
      const due = payload.followUpDate?.trim() || todayIso;
      const [fup] = await db
        .insert(followUps)
        .values({
          followUpCode: fupCode,
          patientId: payload.patientId,
          patientName: payload.patientName,
          community: cleanCommunity,
          encounterCode: inserted.encounterCode,
          reason: `${payload.encounterType}: ${payload.reasonForVisit}`,
          assignedWorkerUid: actor.uid,
          assignedWorkerName: actor.name,
          dueDate: due,
          status: due < todayIso ? 'Overdue' : due === todayIso ? 'Due Soon' : 'Pending',
          priority: payload.referralRequired ? 'High' : 'Medium',
        })
        .returning();
      createdFollowUp = fup;
    }

    // If duplicate or needs_review, create a Data Quality Alert
    let createdAlert = null;
    if (dataQualityStatus !== 'complete') {
      const alertCode = `DQA-${year}-${Math.floor(100 + Math.random() * 899)}`;
      const [alert] = await db
        .insert(dataQualityAlerts)
        .values({
          alertCode,
          alertType: duplicateMatch ? 'Potential Duplicate' : 'Incomplete Follow-Up',
          severity: duplicateMatch ? 'High' : 'Medium',
          patientId: payload.patientId,
          patientName: payload.patientName,
          encounterCode: inserted.encounterCode,
          matchingRecordCode: duplicateMatch ? duplicateMatch.encounterCode : '',
          description: issues.join(' '),
          localVersionJson: JSON.stringify({
            encounterCode: inserted.encounterCode,
            patientId: inserted.patientId,
            encounterType: inserted.encounterType,
            temperature: inserted.temperature,
            bloodPressure: inserted.bloodPressure,
            actionTaken: inserted.actionTaken,
            workerName: inserted.workerName,
          }),
          serverVersionJson: duplicateMatch
            ? JSON.stringify({
                encounterCode: duplicateMatch.encounterCode,
                patientId: duplicateMatch.patientId,
                encounterType: duplicateMatch.encounterType,
                temperature: duplicateMatch.temperature,
                bloodPressure: duplicateMatch.bloodPressure,
                actionTaken: duplicateMatch.actionTaken,
                workerName: duplicateMatch.workerName,
              })
            : '',
          status: 'Open',
        })
        .returning();
      createdAlert = alert;
    }

    // Record in sync_queue table
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await db
      .insert(syncQueue)
      .values({
        queueItemId: `SYNC-${inserted.encounterCode}`,
        patientId: inserted.patientId,
        recordType: 'Encounter',
        workerUid: actor.uid,
        workerName: actor.name,
        status: 'Synchronized',
        payloadSummary: `${inserted.encounterType} visit ${inserted.encounterCode} (${inserted.community})`,
        createdTime: nowTime,
        syncedTime: nowTime,
      })
      .onConflictDoNothing();

    // Record Audit Log
    await db.insert(auditLogs).values({
      userUid: actor.uid,
      userName: actor.name,
      userRole: 'Authorized Operator',
      action: payload.capturedOffline
        ? 'Synchronized Offline Visit'
        : 'Recorded Health Visit',
      resource: `Visit ${inserted.encounterCode} (${inserted.patientName})`,
      status: dataQualityStatus === 'complete' ? 'Success' : 'Flagged for Review',
      ipOrDevice: payload.capturedOffline ? 'Offline Device Sync' : 'NEXORA Live Portal',
    });

    return {
      encounter: inserted,
      followUp: createdFollowUp,
      alert: createdAlert,
    };
  } catch (error) {
    console.error('Database query failed in createOrSyncEncounterRecord:', error);
    throw new Error('Failed to save or synchronize encounter record.', { cause: error });
  }
}

export async function completeFollowUpRecord(
  followUpId: number,
  outcomeNotes: string,
  actor: { uid: string; name: string; role: string }
) {
  try {
    const [updated] = await db
      .update(followUps)
      .set({
        status: 'Completed',
        completedAt: new Date(),
        outcomeNotes:
          outcomeNotes || 'Follow-up completed and verified by care team.',
      })
      .where(eq(followUps.id, followUpId))
      .returning();

    if (updated) {
      await db.insert(auditLogs).values({
        userUid: actor.uid,
        userName: actor.name,
        userRole: 'Authorized Operator',
        action: 'Follow-Up Marked Completed',
        resource: `Follow-Up ${updated.followUpCode} (${updated.patientName})`,
        status: 'Success',
        ipOrDevice: 'NEXORA Live Portal',
      });
    }

    return updated;
  } catch (error) {
    console.error('Database query failed in completeFollowUpRecord:', error);
    throw new Error('Failed to update follow-up status.', { cause: error });
  }
}

export async function resolveDataQualityAlertRecord(
  alertId: number,
  resolutionStatus: string,
  actor: { uid: string; name: string; role: string }
) {
  try {
    const [updated] = await db
      .update(dataQualityAlerts)
      .set({
        status: resolutionStatus,
        resolvedBy: actor.name,
      })
      .where(eq(dataQualityAlerts.id, alertId))
      .returning();

    if (updated) {
      if (updated.alertType === 'Sync Conflict') {
        await db
          .update(syncQueue)
          .set({
            status: 'Synchronized',
            syncedTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
          })
          .where(eq(syncQueue.patientId, updated.patientId));
      }

      await db.insert(auditLogs).values({
        userUid: actor.uid,
        userName: actor.name,
        userRole: 'Authorized Operator',
        action: `Resolved Record Alert (${resolutionStatus})`,
        resource: `Alert ${updated.alertCode} · ${updated.patientName}`,
        status: 'Success',
        ipOrDevice: 'NEXORA Live Portal',
      });
    }

    return updated;
  } catch (error) {
    console.error('Database query failed in resolveDataQualityAlertRecord:', error);
    throw new Error('Failed to resolve data quality alert.', { cause: error });
  }
}
