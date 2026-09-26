import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  region: text('region').notNull(),
  ndpaCompliantMode: boolean('ndpa_compliant_mode').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const communities = pgTable('communities', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  state: text('state').notNull(),
  organizationId: integer('organization_id')
    .references(() => organizations.id)
    .notNull(),
  populationEstimate: integer('population_estimate').notNull(),
  connectivityProfile: text('connectivity_profile').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('worker'),
  organizationId: integer('organization_id').references(() => organizations.id),
  assignedCommunity: text('assigned_community').notNull().default('Ungogo Ward A'),
  workerCode: text('worker_code').notNull().default('CHW-014'),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  patientId: text('patient_id').notNull().unique(),
  fullName: text('full_name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  sex: text('sex').notNull(),
  phoneNumber: text('phone_number').notNull(),
  community: text('community').notNull(),
  emergencyContact: text('emergency_contact').notNull(),
  notes: text('notes').default(''),
  consentVerified: boolean('consent_verified').default(true).notNull(),
  registeredByUid: text('registered_by_uid').notNull(),
  syncStatus: text('sync_status').default('synchronized').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const encounters = pgTable('encounters', {
  id: serial('id').primaryKey(),
  encounterCode: text('encounter_code').notNull().unique(),
  clientRecordId: text('client_record_id').notNull().unique(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  community: text('community').notNull(),
  workerUid: text('worker_uid').notNull(),
  workerName: text('worker_name').notNull(),
  encounterDate: text('encounter_date').notNull(),
  encounterType: text('encounter_type').notNull(),
  reasonForVisit: text('reason_for_visit').notNull(),
  temperature: text('temperature').notNull(),
  bloodPressure: text('blood_pressure').notNull(),
  heartRate: text('heart_rate').notNull(),
  respiratoryRate: text('respiratory_rate').notNull(),
  symptoms: text('symptoms').notNull(),
  observations: text('observations').notNull(),
  actionTaken: text('action_taken').notNull(),
  referralRequired: boolean('referral_required').default(false).notNull(),
  referralFacility: text('referral_facility').default(''),
  followUpRequired: boolean('follow_up_required').default(false).notNull(),
  followUpDate: text('follow_up_date').default(''),
  notes: text('notes').default(''),
  dataQualityStatus: text('data_quality_status').notNull().default('complete'),
  validationNotes: text('validation_notes').default(''),
  capturedOffline: boolean('captured_offline').default(false).notNull(),
  synchronizedAt: timestamp('synchronized_at').defaultNow(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const followUps = pgTable('follow_ups', {
  id: serial('id').primaryKey(),
  followUpCode: text('follow_up_code').notNull().unique(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  community: text('community').notNull(),
  encounterCode: text('encounter_code').default(''),
  reason: text('reason').notNull(),
  assignedWorkerUid: text('assigned_worker_uid').notNull(),
  assignedWorkerName: text('assigned_worker_name').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('Pending'),
  priority: text('priority').notNull().default('Medium'),
  completedAt: timestamp('completed_at'),
  outcomeNotes: text('outcome_notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const syncQueue = pgTable('sync_queue', {
  id: serial('id').primaryKey(),
  queueItemId: text('queue_item_id').notNull().unique(),
  patientId: text('patient_id').notNull(),
  recordType: text('record_type').notNull(),
  workerUid: text('worker_uid').notNull(),
  workerName: text('worker_name').notNull(),
  status: text('status').notNull(),
  payloadSummary: text('payload_summary').notNull(),
  createdTime: text('created_time').notNull(),
  syncedTime: text('synced_time').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dataQualityAlerts = pgTable('data_quality_alerts', {
  id: serial('id').primaryKey(),
  alertCode: text('alert_code').notNull().unique(),
  alertType: text('alert_type').notNull(),
  severity: text('severity').notNull(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  encounterCode: text('encounter_code').default(''),
  matchingRecordCode: text('matching_record_code').default(''),
  description: text('description').notNull(),
  localVersionJson: text('local_version_json').default(''),
  serverVersionJson: text('server_version_json').default(''),
  status: text('status').notNull().default('Open'),
  resolvedBy: text('resolved_by').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  status: text('status').notNull().default('Success'),
  ipOrDevice: text('ip_or_device').default('PWA Field Device'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  communities: many(communities),
  users: many(users),
}));

export const communitiesRelations = relations(communities, ({ one }) => ({
  organization: one(organizations, {
    fields: [communities.organizationId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));
