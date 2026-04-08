// src/lib/models.js
// Mirrors the models in safedose-backend exactly.
// Both services share the same MongoDB Atlas cluster.

import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

// ── User ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName:  String,
  email:     String,
  role:      { type: String, enum: ['admin', 'patient', 'caregiver'] },
}, { timestamps: true });

// ── Assignment (caregiver ↔ patient link) ─────────────────────────────────
const AssignmentSchema = new mongoose.Schema({
  caregiverId: { type: ObjectId, ref: 'User',    required: true },
  patientId:   { type: ObjectId, ref: 'Patient', required: true },
  role:        { type: String, enum: ['owner', 'caregiver'], default: 'caregiver' },
}, { timestamps: true });

// ── Patient ───────────────────────────────────────────────────────────────
const PatientSchema = new mongoose.Schema({
  linkedUserId: { type: ObjectId, ref: 'User', default: null },
  firstName:    String,
  lastName:     String,
  email:        String,
  dateOfBirth:  Date,
  notes:        String,
  missedToday:  { type: Number, default: 0 },
}, { timestamps: true });

// ── Medication ────────────────────────────────────────────────────────────
const MedicationSchema = new mongoose.Schema({
  patientId:    { type: ObjectId, ref: 'Patient' },
  name:         String,
  genericName:  String,
  dosage:       String,
  frequency:    String,
  scheduleTimes: [String],
  startDate:    Date,
  endDate:      Date,
  isOngoing:    { type: Boolean, default: true },
  status:       { type: String, enum: ['active', 'stopped'], default: 'active' },
  takenDoses:   String,
  notes:        String,
}, { timestamps: true });

export const User       = mongoose.models.User       || mongoose.model('User',       UserSchema);
export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
export const Patient    = mongoose.models.Patient    || mongoose.model('Patient',    PatientSchema);
export const Medication = mongoose.models.Medication || mongoose.model('Medication', MedicationSchema);
