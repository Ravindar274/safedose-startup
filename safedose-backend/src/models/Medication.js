// src/models/Medication.js

import mongoose from 'mongoose';

/**
 * Medication belongs to a Patient profile, not a User account.
 *
 * patientId → Patient._id  (always set)
 * addedBy   → User._id     (whoever created the record — patient or caregiver)
 *
 * status:
 *   active      — being taken normally
 *   interaction — flagged by FDA interaction check
 *   stopped     — discontinued; kept for history
 *
 * takenDoses:
 *   Format: "YYYY-MM-DD:0,1"  — date prefix + comma-separated dose indices.
 *   If the date prefix doesn't match today the value is treated as empty
 *   (auto-resets at midnight with no cron required).
 */
const MedicationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name:         { type: String, required: true },
    genericName:  { type: String, required: true },
    dosage:       { type: String, required: true },
    frequency:    { type: String, required: true },
    scheduleTimes:{ type: [String], required: true },
    status: {
      type: String,
      enum: ['active', 'interaction', 'stopped'],
      default: 'active',
    },
    rxcui:      { type: String, default: '' },
    takenDoses:  { type: String, default: null },
    emailsSent:  { type: String, default: null }, // "YYYY-MM-DD:doseIdx=bits" bits: 1=email1, 2=email2, 3=both
    startDate:  { type: Date, default: Date.now },
    endDate:    { type: Date, default: null },
    isOngoing:  { type: Boolean, default: true },
    stoppedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Medication ||
  mongoose.model('Medication', MedicationSchema);
