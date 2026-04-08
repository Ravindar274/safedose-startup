// src/models/Patient.js

import mongoose from 'mongoose';

/**
 * A Patient profile stores clinical/personal info only.
 * The caregiver ↔ patient relationship is managed by the Assignment collection.
 *
 * linkedUserId — the patient's own User._id if they have a SafeDose account.
 *                null for patients created by a caregiver on their behalf.
 */
const PatientSchema = new mongoose.Schema(
  {
    linkedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    email:       { type: String, trim: true, lowercase: true, default: '' },
    dateOfBirth: { type: Date, default: null },
    notes:       { type: String, default: '' },
    medications: { type: Number, default: 0 },
    missedToday: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
