export interface ValidationResult {
  isValidToSave: boolean;
  qualityStatus: 'complete' | 'needs_review' | 'duplicate_flagged';
  blockingErrors: string[];
  reviewWarnings: string[];
  duplicateCandidate?: {
    code: string;
    summary: string;
  };
}

export function validatePatientForm(
  input: {
    patientId: string;
    fullName: string;
    dateOfBirth: string;
    sex: string;
    phoneNumber: string;
    community: string;
    emergencyContact: string;
    consentVerified: boolean;
  },
  existingPatients: Array<{
    patientId: string;
    fullName: string;
    dateOfBirth: string;
    community: string;
  }>
): ValidationResult {
  const blockingErrors: string[] = [];
  const reviewWarnings: string[] = [];
  let duplicateCandidate: { code: string; summary: string } | undefined;

  if (!input.fullName.trim() || input.fullName.trim().length < 3) {
    blockingErrors.push('Full name is required (minimum 3 characters).');
  }
  if (!input.dateOfBirth) {
    blockingErrors.push('Date of birth is required.');
  } else {
    const dob = new Date(input.dateOfBirth);
    const now = new Date('2026-09-26');
    if (isNaN(dob.getTime()) || dob > now || dob.getFullYear() < 1910) {
      blockingErrors.push('Date of birth must be a valid past date between 1910 and today.');
    }
  }
  if (!input.sex) {
    blockingErrors.push('Biological sex / gender selection is required.');
  }
  if (!input.community) {
    blockingErrors.push('Assigned community catchment is required.');
  }
  if (!input.consentVerified) {
    blockingErrors.push('Patient privacy & data collection consent must be confirmed.');
  }

  if (!input.phoneNumber.trim()) {
    reviewWarnings.push('Phone number is missing; community follow-up tracing may require physical home visit.');
  }
  if (!input.emergencyContact.trim()) {
    reviewWarnings.push('Emergency contact details are incomplete.');
  }

  const dupById =
    input.patientId.trim() &&
    existingPatients.find(
      (p) => p.patientId.toLowerCase() === input.patientId.trim().toLowerCase()
    );
  const dupByIdentity = existingPatients.find(
    (p) =>
      p.fullName.trim().toLowerCase() === input.fullName.trim().toLowerCase() &&
      p.dateOfBirth === input.dateOfBirth
  );

  const match = dupById || dupByIdentity;
  if (match) {
    duplicateCandidate = {
      code: match.patientId,
      summary: `${match.fullName} (DOB: ${match.dateOfBirth}, ${match.community})`,
    };
    reviewWarnings.push(
      `Potential duplicate patient detected: matches existing record ${match.patientId} (${match.fullName}).`
    );
  }

  const qualityStatus = duplicateCandidate
    ? 'duplicate_flagged'
    : reviewWarnings.length > 0
      ? 'needs_review'
      : 'complete';

  return {
    isValidToSave: blockingErrors.length === 0,
    qualityStatus,
    blockingErrors,
    reviewWarnings,
    duplicateCandidate,
  };
}

export function validateEncounterForm(
  input: {
    patientId: string;
    patientName: string;
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
  },
  existingEncounters: Array<{
    encounterCode: string;
    patientId: string;
    patientName: string;
    encounterDate: string;
    encounterType: string;
  }>
): ValidationResult {
  const blockingErrors: string[] = [];
  const reviewWarnings: string[] = [];
  let duplicateCandidate: { code: string; summary: string } | undefined;

  if (!input.patientId.trim()) {
    blockingErrors.push('Missing patient identifier: select or enter a valid Patient ID.');
  }
  if (!input.encounterDate) {
    blockingErrors.push('Encounter date is required.');
  } else {
    const encDate = new Date(input.encounterDate);
    const maxDate = new Date('2026-09-27');
    if (isNaN(encDate.getTime()) || encDate > maxDate || encDate.getFullYear() < 2020) {
      blockingErrors.push('Invalid encounter date: cannot be in the future or prior to 2020.');
    }
  }
  if (!input.reasonForVisit.trim()) {
    blockingErrors.push('Reason for visit is required.');
  }

  // Temperature check
  const temp = parseFloat(input.temperature);
  if (isNaN(temp)) {
    blockingErrors.push('Temperature (°C) must be a valid number.');
  } else if (temp < 30.0 || temp > 44.0) {
    blockingErrors.push(
      `Impossible vital sign: Temperature ${temp}°C is outside physiological survival bounds (30.0°C – 44.0°C).`
    );
  } else if (temp < 35.0 || temp > 39.5) {
    reviewWarnings.push(
      `Vital sign alert: Temperature (${temp}°C) is outside normal range and flagged for supervisor review.`
    );
  }

  // Blood pressure check (SYS/DIA)
  const bpMatch = input.bloodPressure.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!bpMatch) {
    blockingErrors.push('Blood pressure must be formatted as Systolic/Diastolic (e.g., 120/80).');
  } else {
    const sys = parseInt(bpMatch[1], 10);
    const dia = parseInt(bpMatch[2], 10);
    if (sys < 50 || sys > 280 || dia < 30 || dia > 180 || sys <= dia) {
      blockingErrors.push(
        `Impossible blood pressure reading (${input.bloodPressure} mmHg). Verify systolic > diastolic within physiological limits.`
      );
    } else if (sys >= 140 || dia >= 90) {
      reviewWarnings.push(`Elevated blood pressure (${input.bloodPressure} mmHg) recorded.`);
    }
  }

  // Heart rate check
  const hr = parseInt(input.heartRate, 10);
  if (isNaN(hr)) {
    blockingErrors.push('Heart rate (bpm) is required.');
  } else if (hr < 25 || hr > 250) {
    blockingErrors.push(
      `Impossible vital sign: Heart rate ${hr} bpm is outside physiological bounds (25 – 250 bpm).`
    );
  }

  // Respiratory rate check
  const rr = parseInt(input.respiratoryRate, 10);
  if (isNaN(rr)) {
    blockingErrors.push('Respiratory rate (breaths/min) is required.');
  } else if (rr < 5 || rr > 80) {
    blockingErrors.push(
      `Impossible vital sign: Respiratory rate ${rr}/min is outside physiological bounds (5 – 80 /min).`
    );
  }

  // Completeness checks (Needs Review warnings)
  if (input.followUpRequired && !input.followUpDate?.trim()) {
    reviewWarnings.push(
      'Follow-up is marked required, but Follow-Up Date was left blank (flagged as Incomplete Record).'
    );
  }
  if (input.referralRequired && !input.referralFacility?.trim()) {
    reviewWarnings.push('Referral required is enabled without a target receiving facility.');
  }
  if (!input.observations.trim() || !input.actionTaken.trim()) {
    reviewWarnings.push(
      'Clinical observations or action taken is brief/incomplete; record marked Needs Review.'
    );
  }

  // Duplicate detection: same patientId + encounterDate + encounterType
  const dup = existingEncounters.find(
    (e) =>
      e.patientId.toLowerCase() === input.patientId.trim().toLowerCase() &&
      e.encounterDate === input.encounterDate &&
      e.encounterType === input.encounterType
  );
  if (dup) {
    duplicateCandidate = {
      code: dup.encounterCode,
      summary: `${dup.encounterCode} · ${dup.patientName} · ${dup.encounterType} on ${dup.encounterDate}`,
    };
    reviewWarnings.push(
      `Potential duplicate detected: matches existing encounter ${dup.encounterCode} for ${dup.patientName} on ${dup.encounterDate}.`
    );
  }

  const qualityStatus = duplicateCandidate
    ? 'duplicate_flagged'
    : reviewWarnings.length > 0
      ? 'needs_review'
      : 'complete';

  return {
    isValidToSave: blockingErrors.length === 0,
    qualityStatus,
    blockingErrors,
    reviewWarnings,
    duplicateCandidate,
  };
}

export function buildFhirR4EncounterBundle(encounter: any) {
  const bpParts = (encounter.bloodPressure || '120/80').split('/');
  const systolic = parseInt(bpParts[0], 10) || 120;
  const diastolic = parseInt(bpParts[1], 10) || 80;

  return {
    resourceType: 'Bundle',
    id: `nexora-fhir-bundle-${encounter.encounterCode?.toLowerCase() || 'sample'}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
      tag: [
        {
          system: 'https://nexora.health/fhir/tags',
          code: 'interoperability-ready-r4-model',
          display: 'NEXORA FHIR-Compatible Data Model (MVP Prototype)',
        },
      ],
    },
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:patient-${encounter.patientId}`,
        resource: {
          resourceType: 'Patient',
          id: encounter.patientId,
          identifier: [
            {
              system: 'https://nexora.health/patient-id',
              value: encounter.patientId,
            },
          ],
          name: [
            {
              use: 'official',
              text: encounter.patientName,
            },
          ],
          address: [
            {
              use: 'home',
              district: encounter.community,
              country: 'NG',
            },
          ],
        },
      },
      {
        fullUrl: `urn:uuid:encounter-${encounter.encounterCode}`,
        resource: {
          resourceType: 'Encounter',
          id: encounter.encounterCode,
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'ambulatory / community frontline encounter',
          },
          type: [
            {
              text: encounter.encounterType,
            },
          ],
          subject: {
            reference: `Patient/${encounter.patientId}`,
            display: encounter.patientName,
          },
          participant: [
            {
              individual: {
                display: encounter.workerName,
              },
            },
          ],
          period: {
            start: `${encounter.encounterDate}T09:00:00Z`,
            end: `${encounter.encounterDate}T09:30:00Z`,
          },
          reasonCode: [
            {
              text: encounter.reasonForVisit,
            },
          ],
        },
      },
      {
        fullUrl: `urn:uuid:obs-vitals-${encounter.encounterCode}`,
        resource: {
          resourceType: 'Observation',
          id: `vitals-${encounter.encounterCode}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          subject: {
            reference: `Patient/${encounter.patientId}`,
          },
          encounter: {
            reference: `Encounter/${encounter.encounterCode}`,
          },
          effectiveDateTime: `${encounter.encounterDate}T09:15:00Z`,
          component: [
            {
              code: {
                coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' }],
              },
              valueQuantity: {
                value: parseFloat(encounter.temperature) || 36.8,
                unit: 'Cel',
                system: 'http://unitsofmeasure.org',
              },
            },
            {
              code: {
                coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }],
              },
              valueQuantity: {
                value: systolic,
                unit: 'mm[Hg]',
                system: 'http://unitsofmeasure.org',
              },
            },
            {
              code: {
                coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }],
              },
              valueQuantity: {
                value: diastolic,
                unit: 'mm[Hg]',
                system: 'http://unitsofmeasure.org',
              },
            },
            {
              code: {
                coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }],
              },
              valueQuantity: {
                value: parseInt(encounter.heartRate, 10) || 78,
                unit: '/min',
                system: 'http://unitsofmeasure.org',
              },
            },
            {
              code: {
                coding: [{ system: 'http://loinc.org', code: '9279-1', display: 'Respiratory rate' }],
              },
              valueQuantity: {
                value: parseInt(encounter.respiratoryRate, 10) || 18,
                unit: '/min',
                system: 'http://unitsofmeasure.org',
              },
            },
          ],
        },
      },
    ],
  };
}
