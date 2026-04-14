// src/models/Patient.js
// Stores both the clinical record for any patient AND the profile/preferences
// for patients who have a SafeDose account (linkedUserId is set).
//
// linkedUserId — the patient's own User._id when they have a SafeDose account.
//                null for patients created by a caregiver on their behalf.

import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    linkedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    email:       { type: String, trim: true, lowercase: true, default: null, sparse: true },
    dateOfBirth: { type: Date,   default: null },
    gender:      { type: String, default: '' },
    notes:       { type: String, default: '' },

    // Live counters (updated by scheduler / caregiver views)
    medications: { type: Number, default: 0 },
    missedToday: { type: Number, default: 0 },

    // Notification preferences — only meaningful when linkedUserId is set
    notifications: {
      email:   { type: Boolean, default: false },
      desktop: { type: Boolean, default: false },
    },
    pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

PatientSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
