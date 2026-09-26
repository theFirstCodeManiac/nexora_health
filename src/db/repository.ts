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

let isSeeding = false;
let hasSeeded = false;

export async function ensureSeeded() {
  if (hasSeeded || isSeeding) return;
  isSeeding = true;
  try {
    const existingOrgs = await db.select().from(organizations).limit(1);
    if (existingOrgs.length > 0) {
      hasSeeded = true;
      isSeeding = false;
      return;
    }

    // 1. Seed Organization
    const [org] = await db
      .insert(organizations)
      .values({
        code: 'ORG-NGA-PHC-01',
        name: 'Northern Primary Health Infrastructure Network',
        region: 'Kano & Kaduna Catchment Zone',
        ndpaCompliantMode: true,
      })
      .onConflictDoNothing()
      .returning();

    const orgId = org?.id || 1;

    // 2. Seed Communities
    const communityList = [
      {
        code: 'COM-UNG-01',
        name: 'Ungogo Ward A',
        state: 'Kano',
        organizationId: orgId,
        populationEstimate: 14200,
        connectivityProfile: 'Intermittent 2G / Edge',
      },
      {
        code: 'COM-SAB-02',
        name: 'Sabon Gari Rural',
        state: 'Kaduna',
        organizationId: orgId,
        populationEstimate: 9850,
        connectivityProfile: 'Offline Outpost (Sync on Return)',
      },
      {
        code: 'COM-KUM-03',
        name: 'Kumbotso South',
        state: 'Kano',
        organizationId: orgId,
        populationEstimate: 18400,
        connectivityProfile: 'Spotty 3G Cellular',
      },
      {
        code: 'COM-ZAR-04',
        name: 'Zaria Outpost B',
        state: 'Kaduna',
        organizationId: orgId,
        populationEstimate: 11300,
        connectivityProfile: 'Low-Signal Rural Corridor',
      },
      {
        code: 'COM-BIC-05',
        name: 'Bichi North',
        state: 'Kano',
        organizationId: orgId,
        populationEstimate: 7600,
        connectivityProfile: 'Offline Outpost (Daily Batch)',
      },
    ];

    for (const c of communityList) {
      await db.insert(communities).values(c).onConflictDoNothing();
    }

    // 3. Seed Users (Frontline Workers + Supervisors)
    const demoUsers = [
      {
        uid: 'demo-worker-uid-001',
        email: 'worker@nexora.health',
        fullName: 'Amina Bello (CHW)',
        role: 'worker',
        organizationId: orgId,
        assignedCommunity: 'Ungogo Ward A',
        workerCode: 'CHW-014',
      },
      {
        uid: 'demo-supervisor-uid-001',
        email: 'supervisor@nexora.health',
        fullName: 'Dr. Tunde Okonkwo',
        role: 'supervisor',
        organizationId: orgId,
        assignedCommunity: 'Kano & Kaduna Catchment Zone',
        workerCode: 'SUP-002',
      },
      {
        uid: 'demo-worker-uid-002',
        email: 'musa.danjuma@nexora.health',
        fullName: 'Musa Danjuma (CHW)',
        role: 'worker',
        organizationId: orgId,
        assignedCommunity: 'Sabon Gari Rural',
        workerCode: 'CHW-018',
      },
      {
        uid: 'demo-worker-uid-003',
        email: 'grace.adeyemi@nexora.health',
        fullName: 'Grace Adeyemi (RN)',
        role: 'worker',
        organizationId: orgId,
        assignedCommunity: 'Kumbotso South',
        workerCode: 'CHW-021',
      },
      {
        uid: 'demo-worker-uid-004',
        email: 'ibrahim.sani@nexora.health',
        fullName: 'Ibrahim Sani (CHW)',
        role: 'worker',
        organizationId: orgId,
        assignedCommunity: 'Zaria Outpost B',
        workerCode: 'CHW-025',
      },
      {
        uid: 'demo-worker-uid-005',
        email: 'halima.yusuf@nexora.health',
        fullName: 'Halima Yusuf (CHW)',
        role: 'worker',
        organizationId: orgId,
        assignedCommunity: 'Bichi North',
        workerCode: 'CHW-029',
      },
    ];

    for (const u of demoUsers) {
      await db.insert(users).values(u).onConflictDoNothing();
    }

    // 4. Seed 24 Fictional Patients
    const fictionalPatients = [
      { patientId: 'NXR-PT-1001', fullName: 'Zainab Abdullahi', dateOfBirth: '1996-04-12', sex: 'Female', phoneNumber: '+234-803-010-1001', community: 'Ungogo Ward A', emergencyContact: 'Yusuf Abdullahi (Spouse) +234-803-010-9001', notes: 'Fictional maternal care record - 28 weeks gestation.' },
      { patientId: 'NXR-PT-1002', fullName: 'Suleiman Garba', dateOfBirth: '2022-08-19', sex: 'Male', phoneNumber: '+234-803-010-1002', community: 'Ungogo Ward A', emergencyContact: 'Hauwa Garba (Mother) +234-803-010-9002', notes: 'Fictional pediatric immunization & nutrition tracking.' },
      { patientId: 'NXR-PT-1003', fullName: 'Fatima Lawal', dateOfBirth: '1988-11-03', sex: 'Female', phoneNumber: '+234-803-010-1003', community: 'Sabon Gari Rural', emergencyContact: 'Kabiru Lawal (Brother) +234-803-010-9003', notes: 'Fictional hypertension monitoring record.' },
      { patientId: 'NXR-PT-1004', fullName: 'Chinedu Okafor', dateOfBirth: '1974-02-25', sex: 'Male', phoneNumber: '+234-803-010-1004', community: 'Kumbotso South', emergencyContact: 'Ngozi Okafor (Spouse) +234-803-010-9004', notes: 'Fictional outpatient chronic follow-up.' },
      { patientId: 'NXR-PT-1005', fullName: 'Hadiza Mohammed', dateOfBirth: '2001-06-14', sex: 'Female', phoneNumber: '+234-803-010-1005', community: 'Ungogo Ward A', emergencyContact: 'Bala Mohammed (Father) +234-803-010-9005', notes: 'Fictional antenatal visit schedule.' },
      { patientId: 'NXR-PT-1006', fullName: 'Yakubu Usman', dateOfBirth: '2023-01-30', sex: 'Male', phoneNumber: '+234-803-010-1006', community: 'Zaria Outpost B', emergencyContact: 'Maryam Usman (Mother) +234-803-010-9006', notes: 'Fictional pediatric febrile assessment.' },
      { patientId: 'NXR-PT-1007', fullName: 'Aisha Maiwada', dateOfBirth: '1993-09-08', sex: 'Female', phoneNumber: '+234-803-010-1007', community: 'Bichi North', emergencyContact: 'Sani Maiwada (Spouse) +234-803-010-9007', notes: 'Fictional postnatal follow-up.' },
      { patientId: 'NXR-PT-1008', fullName: 'Bashir Aliyu', dateOfBirth: '1969-12-01', sex: 'Male', phoneNumber: '+234-803-010-1008', community: 'Ungogo Ward A', emergencyContact: 'Lami Aliyu (Spouse) +234-803-010-9008', notes: 'Fictional elevated blood pressure monitoring.' },
      { patientId: 'NXR-PT-1009', fullName: 'Khadija Idris', dateOfBirth: '2021-05-22', sex: 'Female', phoneNumber: '+234-803-010-1009', community: 'Sabon Gari Rural', emergencyContact: 'Idris Musa (Father) +234-803-010-9009', notes: 'Fictional MUAC nutrition screening.' },
      { patientId: 'NXR-PT-1010', fullName: 'emeka Nwachukwu', dateOfBirth: '1983-07-17', sex: 'Male', phoneNumber: '+234-803-010-1010', community: 'Kumbotso South', emergencyContact: 'Adaeze Nwachukwu +234-803-010-9010', notes: 'Fictional respiratory triage encounter.' },
      { patientId: 'NXR-PT-1011', fullName: 'Bilkisu Abubakar', dateOfBirth: '1999-03-27', sex: 'Female', phoneNumber: '+234-803-010-1011', community: 'Zaria Outpost B', emergencyContact: 'Abubakar Sadiq +234-803-010-9011', notes: 'Fictional first-trimester maternal registration.' },
      { patientId: 'NXR-PT-1012', fullName: 'Umar Farouk', dateOfBirth: '2024-02-11', sex: 'Male', phoneNumber: '+234-803-010-1012', community: 'Ungogo Ward A', emergencyContact: 'Safiya Farouk (Mother) +234-803-010-9012', notes: 'Fictional routine pentavalent vaccination.' },
      { patientId: 'NXR-PT-1013', fullName: 'Rukayya Shehu', dateOfBirth: '1991-10-19', sex: 'Female', phoneNumber: '+234-803-010-1013', community: 'Bichi North', emergencyContact: 'Shehu Dandago +234-803-010-9013', notes: 'Fictional malaria RDT positive follow-up.' },
      { patientId: 'NXR-PT-1014', fullName: 'Dauda Ezekiel', dateOfBirth: '1978-04-05', sex: 'Male', phoneNumber: '+234-803-010-1014', community: 'Sabon Gari Rural', emergencyContact: 'Esther Ezekiel +234-803-010-9014', notes: 'Fictional adult general outpatient visit.' },
      { patientId: 'NXR-PT-1015', fullName: 'Nafisa Rabiu', dateOfBirth: '2003-01-09', sex: 'Female', phoneNumber: '+234-803-010-1015', community: 'Kumbotso South', emergencyContact: 'Rabiu Kano +234-803-010-9015', notes: 'Fictional maternal iron/folate supplementation.' },
      { patientId: 'NXR-PT-1016', fullName: 'Sadiq Mustapha', dateOfBirth: '2020-11-29', sex: 'Male', phoneNumber: '+234-803-010-1016', community: 'Ungogo Ward A', emergencyContact: 'Rahma Mustapha +234-803-010-9016', notes: 'Fictional oral rehydration follow-up.' },
      { patientId: 'NXR-PT-1017', fullName: 'Halima Jibril', dateOfBirth: '1995-08-14', sex: 'Female', phoneNumber: '+234-803-010-1017', community: 'Zaria Outpost B', emergencyContact: 'Jibril Isa +234-803-010-9017', notes: 'Fictional antenatal blood pressure monitoring.' },
      { patientId: 'NXR-PT-1018', fullName: 'Tanimu Bako', dateOfBirth: '1965-06-20', sex: 'Male', phoneNumber: '+234-803-010-1018', community: 'Bichi North', emergencyContact: 'Hassana Bako +234-803-010-9018', notes: 'Fictional chronic blood pressure screening.' },
      { patientId: 'NXR-PT-1019', fullName: 'Maryam Salisu', dateOfBirth: '2023-07-04', sex: 'Female', phoneNumber: '+234-803-010-1019', community: 'Ungogo Ward A', emergencyContact: 'Salisu Kano +234-803-010-9019', notes: 'Fictional growth monitoring.' },
      { patientId: 'NXR-PT-1020', fullName: 'Nasiru Kabiru', dateOfBirth: '1986-03-15', sex: 'Male', phoneNumber: '+234-803-010-1020', community: 'Sabon Gari Rural', emergencyContact: 'Asmau Kabiru +234-803-010-9020', notes: 'Fictional acute febrile illness triage.' },
      { patientId: 'NXR-PT-1021', fullName: 'Zuwaira Haruna', dateOfBirth: '1998-12-12', sex: 'Female', phoneNumber: '+234-803-010-1021', community: 'Kumbotso South', emergencyContact: 'Haruna Audu +234-803-010-9021', notes: 'Fictional postpartum check.' },
      { patientId: 'NXR-PT-1022', fullName: 'Lukman Bello', dateOfBirth: '2022-03-08', sex: 'Male', phoneNumber: '+234-803-010-1022', community: 'Zaria Outpost B', emergencyContact: 'Bello Sani +234-803-010-9022', notes: 'Fictional vitamin A supplementation.' },
      { patientId: 'NXR-PT-1023', fullName: 'Samira Adamu', dateOfBirth: '1994-05-01', sex: 'Female', phoneNumber: '+234-803-010-1023', community: 'Bichi North', emergencyContact: 'Adamu Gaya +234-803-010-9023', notes: 'Fictional maternal tetanus toxoid visit.' },
      { patientId: 'NXR-PT-1024', fullName: 'Zainab Abdullahi', dateOfBirth: '1996-04-12', sex: 'Female', phoneNumber: '+234-803-010-1001', community: 'Ungogo Ward A', emergencyContact: 'Yusuf Abdullahi +234-803-010-9001', notes: 'Potential duplicate registration created during offline clinic day.' },
    ];

    for (const p of fictionalPatients) {
      await db
        .insert(patients)
        .values({
          ...p,
          consentVerified: true,
          registeredByUid: 'demo-worker-uid-001',
          syncStatus: 'synchronized',
          version: 1,
        })
        .onConflictDoNothing();
    }

    // 5. Seed 52 Fictional Encounters across dates and communities
    const encounterTypes = [
      'Maternal Health',
      'Malaria / Febrile Triage',
      'Child Immunization',
      'Nutrition Screening',
      'Chronic Care Follow-Up',
      'General Outpatient',
    ];

    const workerProfiles = [
      { uid: 'demo-worker-uid-001', name: 'Amina Bello (CHW)', community: 'Ungogo Ward A' },
      { uid: 'demo-worker-uid-002', name: 'Musa Danjuma (CHW)', community: 'Sabon Gari Rural' },
      { uid: 'demo-worker-uid-003', name: 'Grace Adeyemi (RN)', community: 'Kumbotso South' },
      { uid: 'demo-worker-uid-004', name: 'Ibrahim Sani (CHW)', community: 'Zaria Outpost B' },
      { uid: 'demo-worker-uid-005', name: 'Halima Yusuf (CHW)', community: 'Bichi North' },
    ];

    const dates = [
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ];

    for (let i = 1; i <= 52; i++) {
      const pt = fictionalPatients[(i - 1) % fictionalPatients.length];
      const w = workerProfiles[(i - 1) % workerProfiles.length];
      const encType = encounterTypes[(i - 1) % encounterTypes.length];
      const dateStr = i > 40 ? '2026-09-26' : dates[i % dates.length];
      const isIncomplete = i === 14 || i === 29 || i === 44;
      const isDuplicate = i === 48;
      const needsReferral = i % 7 === 0;
      const needsFollowUp = i % 4 === 0;

      await db
        .insert(encounters)
        .values({
          encounterCode: `ENC-2026-${8100 + i}`,
          clientRecordId: `seed-client-rec-${8100 + i}`,
          patientId: pt.patientId,
          patientName: pt.fullName,
          community: pt.community,
          workerUid: i > 42 ? 'demo-worker-uid-001' : w.uid,
          workerName: i > 42 ? 'Amina Bello (CHW)' : w.name,
          encounterDate: dateStr,
          encounterType: encType,
          reasonForVisit:
            encType === 'Maternal Health'
              ? 'Routine antenatal vitals and fetal movement check'
              : encType === 'Malaria / Febrile Triage'
                ? 'Intermittent fever for 48 hours, RDT screening performed'
                : encType === 'Child Immunization'
                  ? 'Scheduled childhood immunization and weight tracking'
                  : encType === 'Nutrition Screening'
                    ? 'Community MUAC tape screening and dietary counseling'
                    : 'Scheduled community primary care checkup',
          temperature: encType === 'Malaria / Febrile Triage' ? '38.4' : '36.8',
          bloodPressure: encType === 'Chronic Care Follow-Up' ? '148/94' : '118/76',
          heartRate: encType === 'Malaria / Febrile Triage' ? '98' : '78',
          respiratoryRate: '18',
          symptoms:
            encType === 'Malaria / Febrile Triage'
              ? 'Fever, Chills, Fatigue'
              : encType === 'Chronic Care Follow-Up'
                ? 'Mild Headache, Fatigue'
                : 'None reported',
          observations:
            'Patient assessed at rural health post using structured NEXORA protocol. Vital signs recorded.',
          actionTaken:
            needsReferral
              ? 'Stabilized and issued structured referral slip to district general hospital.'
              : 'Provided primary care intervention, health education, and scheduled community follow-up.',
          referralRequired: needsReferral,
          referralFacility: needsReferral ? 'Murtala Muhammed Specialist Hospital' : '',
          followUpRequired: needsFollowUp,
          followUpDate: isIncomplete ? '' : needsFollowUp ? '2026-09-28' : '',
          notes: isIncomplete
            ? 'Follow-up required checked but follow-up date omitted during rapid field intake.'
            : 'Captured via NEXORA Field PWA.',
          dataQualityStatus: isDuplicate
            ? 'duplicate_flagged'
            : isIncomplete
              ? 'needs_review'
              : 'complete',
          validationNotes: isDuplicate
            ? 'Potential duplicate encounter for same patient within 24h window.'
            : isIncomplete
              ? 'Missing target follow-up date despite follow-up flag enabled.'
              : 'All required clinical and operational fields verified.',
          capturedOffline: i % 2 === 0,
          version: 1,
        })
        .onConflictDoNothing();
    }

    // 6. Seed Follow-Ups (Summary: due today, overdue, upcoming, completed)
    const followUpSeed = [
      {
        followUpCode: 'FUP-2026-301',
        patientId: 'NXR-PT-1001',
        patientName: 'Zainab Abdullahi',
        community: 'Ungogo Ward A',
        encounterCode: 'ENC-2026-8101',
        reason: 'High-risk third trimester BP re-check & fetal heart rate check',
        assignedWorkerUid: 'demo-worker-uid-001',
        assignedWorkerName: 'Amina Bello (CHW)',
        dueDate: '2026-09-26',
        status: 'Due Soon',
        priority: 'High',
      },
      {
        followUpCode: 'FUP-2026-302',
        patientId: 'NXR-PT-1002',
        patientName: 'Suleiman Garba',
        community: 'Ungogo Ward A',
        encounterCode: 'ENC-2026-8102',
        reason: '72-hour post-ACT malaria treatment clearance check',
        assignedWorkerUid: 'demo-worker-uid-001',
        assignedWorkerName: 'Amina Bello (CHW)',
        dueDate: '2026-09-26',
        status: 'Due Soon',
        priority: 'High',
      },
      {
        followUpCode: 'FUP-2026-303',
        patientId: 'NXR-PT-1008',
        patientName: 'Bashir Aliyu',
        community: 'Ungogo Ward A',
        encounterCode: 'ENC-2026-8108',
        reason: 'Stage 2 hypertension medication adherence verification',
        assignedWorkerUid: 'demo-worker-uid-001',
        assignedWorkerName: 'Amina Bello (CHW)',
        dueDate: '2026-09-26',
        status: 'Due Soon',
        priority: 'Medium',
      },
      {
        followUpCode: 'FUP-2026-304',
        patientId: 'NXR-PT-1003',
        patientName: 'Fatima Lawal',
        community: 'Sabon Gari Rural',
        encounterCode: 'ENC-2026-8103',
        reason: 'Missed district clinic referral verification',
        assignedWorkerUid: 'demo-worker-uid-002',
        assignedWorkerName: 'Musa Danjuma (CHW)',
        dueDate: '2026-09-23',
        status: 'Overdue',
        priority: 'High',
      },
      {
        followUpCode: 'FUP-2026-305',
        patientId: 'NXR-PT-1009',
        patientName: 'Khadija Idris',
        community: 'Sabon Gari Rural',
        encounterCode: 'ENC-2026-8109',
        reason: 'Severe acute malnutrition RUTF ration resupply & MUAC check',
        assignedWorkerUid: 'demo-worker-uid-002',
        assignedWorkerName: 'Musa Danjuma (CHW)',
        dueDate: '2026-09-24',
        status: 'Overdue',
        priority: 'High',
      },
      {
        followUpCode: 'FUP-2026-306',
        patientId: 'NXR-PT-1005',
        patientName: 'Hadiza Mohammed',
        community: 'Ungogo Ward A',
        encounterCode: 'ENC-2026-8105',
        reason: 'Antenatal tetanus toxoid dose 2 scheduling',
        assignedWorkerUid: 'demo-worker-uid-001',
        assignedWorkerName: 'Amina Bello (CHW)',
        dueDate: '2026-09-28',
        status: 'Pending',
        priority: 'Medium',
      },
      {
        followUpCode: 'FUP-2026-307',
        patientId: 'NXR-PT-1006',
        patientName: 'Yakubu Usman',
        community: 'Zaria Outpost B',
        encounterCode: 'ENC-2026-8106',
        reason: 'Post-febrile hydration & appetite home visit',
        assignedWorkerUid: 'demo-worker-uid-004',
        assignedWorkerName: 'Ibrahim Sani (CHW)',
        dueDate: '2026-09-29',
        status: 'Pending',
        priority: 'Medium',
      },
      {
        followUpCode: 'FUP-2026-308',
        patientId: 'NXR-PT-1011',
        patientName: 'Bilkisu Abubakar',
        community: 'Zaria Outpost B',
        encounterCode: 'ENC-2026-8111',
        reason: 'First trimester nutritional anemia follow-up',
        assignedWorkerUid: 'demo-worker-uid-004',
        assignedWorkerName: 'Ibrahim Sani (CHW)',
        dueDate: '2026-09-30',
        status: 'Pending',
        priority: 'Low',
      },
      {
        followUpCode: 'FUP-2026-309',
        patientId: 'NXR-PT-1013',
        patientName: 'Rukayya Shehu',
        community: 'Bichi North',
        encounterCode: 'ENC-2026-8113',
        reason: 'Confirm completion of 3-day antimalarial regimen',
        assignedWorkerUid: 'demo-worker-uid-005',
        assignedWorkerName: 'Halima Yusuf (CHW)',
        dueDate: '2026-09-25',
        status: 'Completed',
        priority: 'Medium',
      },
    ];

    for (const f of followUpSeed) {
      await db.insert(followUps).values(f).onConflictDoNothing();
    }

    // 7. Seed Sync Queue History
    const syncHistory = [
      {
        queueItemId: 'SYNC-Q-9001',
        patientId: 'NXR-PT-1001',
        recordType: 'Encounter',
        workerUid: 'demo-worker-uid-001',
        workerName: 'Amina Bello (CHW)',
        status: 'Synchronized',
        payloadSummary: 'Maternal Health encounter ENC-2026-8149 (Ungogo Ward A)',
        createdTime: '2026-09-26 08:14:22',
        syncedTime: '2026-09-26 09:02:10',
      },
      {
        queueItemId: 'SYNC-Q-9002',
        patientId: 'NXR-PT-1002',
        recordType: 'Encounter',
        workerUid: 'demo-worker-uid-001',
        workerName: 'Amina Bello (CHW)',
        status: 'Synchronized',
        payloadSummary: 'Child Immunization encounter ENC-2026-8150 (Ungogo Ward A)',
        createdTime: '2026-09-26 08:29:05',
        syncedTime: '2026-09-26 09:02:11',
      },
      {
        queueItemId: 'SYNC-Q-9003',
        patientId: 'NXR-PT-1005',
        recordType: 'Encounter',
        workerUid: 'demo-worker-uid-001',
        workerName: 'Amina Bello (CHW)',
        status: 'Synchronized',
        payloadSummary: 'Nutrition Screening encounter ENC-2026-8151 (Ungogo Ward A)',
        createdTime: '2026-09-26 08:45:19',
        syncedTime: '2026-09-26 09:02:12',
      },
      {
        queueItemId: 'SYNC-Q-9004',
        patientId: 'NXR-PT-1003',
        recordType: 'Encounter',
        workerUid: 'demo-worker-uid-002',
        workerName: 'Musa Danjuma (CHW)',
        status: 'Conflict',
        payloadSummary: 'Blood pressure & follow-up update modified on two field tablets while offline',
        createdTime: '2026-09-25 16:40:00',
        syncedTime: '',
      },
    ];

    for (const sq of syncHistory) {
      await db.insert(syncQueue).values(sq).onConflictDoNothing();
    }

    // 8. Seed Data Quality Alerts (including Duplicate Detection & Version Conflict)
    const alertsSeed = [
      {
        alertCode: 'DQA-2026-01',
        alertType: 'Potential Duplicate',
        severity: 'High',
        patientId: 'NXR-PT-1024',
        patientName: 'Zainab Abdullahi',
        encounterCode: 'ENC-2026-8148',
        matchingRecordCode: 'NXR-PT-1001 / ENC-2026-8101',
        description:
          'Exact match on Full Name (Zainab Abdullahi), Date of Birth (1996-04-12), and Community (Ungogo Ward A) registered under NXR-PT-1024 while offline.',
        localVersionJson: JSON.stringify({
          patientId: 'NXR-PT-1024',
          fullName: 'Zainab Abdullahi',
          dob: '1996-04-12',
          bloodPressure: '124/82',
          temperature: '36.9',
          worker: 'Amina Bello (CHW-014)',
          capturedMode: 'Offline Field Queue',
        }),
        serverVersionJson: JSON.stringify({
          patientId: 'NXR-PT-1001',
          fullName: 'Zainab Abdullahi',
          dob: '1996-04-12',
          bloodPressure: '120/78',
          temperature: '36.7',
          worker: 'Amina Bello (CHW-014)',
          capturedMode: 'Primary Registry Record',
        }),
        status: 'Open',
      },
      {
        alertCode: 'DQA-2026-02',
        alertType: 'Sync Conflict',
        severity: 'High',
        patientId: 'NXR-PT-1003',
        patientName: 'Fatima Lawal',
        encounterCode: 'ENC-2026-8103',
        matchingRecordCode: 'ENC-2026-8103 (Rev 2)',
        description:
          'Concurrent offline edits detected for ENC-2026-8103 between Field Tablet CHW-014 and District Nurse Tablet CHW-018.',
        localVersionJson: JSON.stringify({
          encounterCode: 'ENC-2026-8103',
          bloodPressure: '152/96',
          heartRate: '88',
          actionTaken: 'Initiated antihypertensive refill + urgent 48h home re-check',
          followUpDate: '2026-09-27',
          modifiedBy: 'Amina Bello (CHW-014) - Offline 16:40',
        }),
        serverVersionJson: JSON.stringify({
          encounterCode: 'ENC-2026-8103',
          bloodPressure: '146/92',
          heartRate: '82',
          actionTaken: 'Counseled on low-sodium diet and routine 7-day clinic review',
          followUpDate: '2026-10-02',
          modifiedBy: 'Musa Danjuma (CHW-018) - Synced 16:15',
        }),
        status: 'Open',
      },
      {
        alertCode: 'DQA-2026-03',
        alertType: 'Incomplete Follow-Up',
        severity: 'Medium',
        patientId: 'NXR-PT-1014',
        patientName: 'Dauda Ezekiel',
        encounterCode: 'ENC-2026-8114',
        matchingRecordCode: '',
        description:
          'Encounter marked "Follow-Up Required = Yes", but target Follow-Up Date was omitted prior to batch upload.',
        localVersionJson: '',
        serverVersionJson: '',
        status: 'Open',
      },
      {
        alertCode: 'DQA-2026-04',
        alertType: 'Incomplete Follow-Up',
        severity: 'Medium',
        patientId: 'NXR-PT-1005',
        patientName: 'Hadiza Mohammed',
        encounterCode: 'ENC-2026-8129',
        matchingRecordCode: '',
        description:
          'Maternal health encounter missing scheduled next ANC visit date and referral facility code.',
        localVersionJson: '',
        serverVersionJson: '',
        status: 'Open',
      },
    ];

    for (const a of alertsSeed) {
      await db.insert(dataQualityAlerts).values(a).onConflictDoNothing();
    }

    // 9. Seed Audit Logs
    const logsSeed = [
      {
        userUid: 'demo-worker-uid-001',
        userName: 'Amina Bello (CHW)',
        userRole: 'Frontline Worker',
        action: 'Synchronized Offline Batch (3 Encounters)',
        resource: 'SyncBatch #SYNC-Q-9001..9003',
        status: 'Success',
        ipOrDevice: 'Android PWA · Ungogo Node',
      },
      {
        userUid: 'demo-supervisor-uid-001',
        userName: 'Dr. Tunde Okonkwo',
        userRole: 'Supervisor',
        action: 'Reviewed FHIR R4 Bundle Export',
        resource: 'Encounter ENC-2026-8149',
        status: 'Success',
        ipOrDevice: 'District Ops Console',
      },
      {
        userUid: 'demo-worker-uid-002',
        userName: 'Musa Danjuma (CHW)',
        userRole: 'Frontline Worker',
        action: 'Created Patient Encounter (Offline Queue)',
        resource: 'Encounter ENC-2026-8147',
        status: 'Success',
        ipOrDevice: 'Android PWA · Sabon Gari Node',
      },
      {
        userUid: 'demo-supervisor-uid-001',
        userName: 'Dr. Tunde Okonkwo',
        userRole: 'Supervisor',
        action: 'Completed Follow-Up Case Review',
        resource: 'Follow-Up FUP-2026-309 (Rukayya Shehu)',
        status: 'Success',
        ipOrDevice: 'District Ops Console',
      },
      {
        userUid: 'demo-worker-uid-003',
        userName: 'Grace Adeyemi (RN)',
        userRole: 'Frontline Worker',
        action: 'Registered New Patient (Consent Verified)',
        resource: 'Patient NXR-PT-1021 (Zuwaira Haruna)',
        status: 'Success',
        ipOrDevice: 'Tablet PWA · Kumbotso Node',
      },
    ];

    for (const l of logsSeed) {
      await db.insert(auditLogs).values(l);
    }

    hasSeeded = true;
  } catch (error) {
    console.error('Database seed check failed:', error);
  } finally {
    isSeeding = false;
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
      db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(60),
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
    const generatedId =
      payload.patientId?.trim() ||
      `NXR-PT-${1025 + existingPatients.length + Math.floor(Math.random() * 90)}`;

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
        community: payload.community,
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
      const alertCode = `DQA-2026-${Math.floor(100 + Math.random() * 899)}`;
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
      userRole: actor.role === 'supervisor' ? 'Supervisor' : 'Frontline Worker',
      action: 'Registered Patient Record',
      resource: `Patient ${created.patientId} (${created.fullName})`,
      status: duplicateCandidate ? 'Flagged Duplicate' : 'Success',
      ipOrDevice: 'PWA Field Device',
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
    const encounterCode = `ENC-2026-${8200 + allEncounters.length + Math.floor(Math.random() * 90)}`;

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
      issues.push(`Potential duplicate of ${duplicateMatch.encounterCode} recorded on ${duplicateMatch.encounterDate}.`);
    } else if (issues.length > 0) {
      dataQualityStatus = 'needs_review';
    }

    const [inserted] = await db
      .insert(encounters)
      .values({
        encounterCode,
        clientRecordId: clientRecId,
        patientId: payload.patientId,
        patientName: payload.patientName,
        community: payload.community || 'Ungogo Ward A',
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
        observations: payload.observations || 'Recorded in field.',
        actionTaken: payload.actionTaken || 'Standard protocol applied.',
        referralRequired: Boolean(payload.referralRequired),
        referralFacility: payload.referralFacility || '',
        followUpRequired: Boolean(payload.followUpRequired),
        followUpDate: payload.followUpDate || '',
        notes: payload.notes || '',
        dataQualityStatus,
        validationNotes:
          issues.length > 0
            ? issues.join(' ')
            : 'Complete — passed automated schema & range validation.',
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
      const fupCode = `FUP-2026-${Math.floor(400 + Math.random() * 599)}`;
      const due = payload.followUpDate?.trim() || '2026-09-28';
      const [fup] = await db
        .insert(followUps)
        .values({
          followUpCode: fupCode,
          patientId: payload.patientId,
          patientName: payload.patientName,
          community: payload.community || 'Ungogo Ward A',
          encounterCode: inserted.encounterCode,
          reason: `${payload.encounterType}: ${payload.reasonForVisit}`,
          assignedWorkerUid: actor.uid,
          assignedWorkerName: actor.name,
          dueDate: due,
          status: due <= '2026-09-26' ? 'Due Soon' : 'Pending',
          priority: payload.referralRequired ? 'High' : 'Medium',
        })
        .returning();
      createdFollowUp = fup;
    }

    // If duplicate or needs_review, create a Data Quality Alert for the supervisor
    let createdAlert = null;
    if (dataQualityStatus !== 'complete') {
      const alertCode = `DQA-2026-${Math.floor(100 + Math.random() * 899)}`;
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
        payloadSummary: `${inserted.encounterType} encounter ${inserted.encounterCode} (${inserted.community})`,
        createdTime: nowTime,
        syncedTime: nowTime,
      })
      .onConflictDoNothing();

    // Record Audit Log
    await db.insert(auditLogs).values({
      userUid: actor.uid,
      userName: actor.name,
      userRole: actor.role === 'supervisor' ? 'Supervisor' : 'Frontline Worker',
      action: payload.capturedOffline
        ? 'Synchronized Offline Encounter'
        : 'Recorded Health Encounter',
      resource: `Encounter ${inserted.encounterCode} (${inserted.patientName})`,
      status: dataQualityStatus === 'complete' ? 'Success' : 'Flagged for Review',
      ipOrDevice: payload.capturedOffline ? 'Offline Queue Sync Engine' : 'PWA Field Device',
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
        userRole: actor.role === 'supervisor' ? 'Supervisor' : 'Frontline Worker',
        action: 'Follow-Up Marked Completed',
        resource: `Follow-Up ${updated.followUpCode} (${updated.patientName})`,
        status: 'Success',
        ipOrDevice: actor.role === 'supervisor' ? 'Supervisor Console' : 'PWA Field Device',
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
      // Also update matching syncQueue item if it was a conflict
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
        userRole: actor.role === 'supervisor' ? 'Supervisor' : 'Frontline Worker',
        action: `Resolved Alert (${resolutionStatus})`,
        resource: `Alert ${updated.alertCode} · ${updated.patientName}`,
        status: 'Success',
        ipOrDevice: 'Supervisor Console',
      });
    }

    return updated;
  } catch (error) {
    console.error('Database query failed in resolveDataQualityAlertRecord:', error);
    throw new Error('Failed to resolve data quality alert.', { cause: error });
  }
}
