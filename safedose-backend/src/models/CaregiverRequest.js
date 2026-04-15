// src/models/CaregiverRequest.js

import mongoose from 'mongoose';

/**
 * CaregiverRequest tracks hire requests between patients and caregivers.
 *
 * initiatedBy:
 *   'patient'   — patient sent the request to a caregiver
 *   'caregiver' — caregiver sent an invitation to a registered patient
 *
 * status:
 *   'pending'  — awaiting the other party's response
 *   'accepted' — accepted; an Assignment has been created
 *   'declined' — declined
 */
const CaregiverRequestSchema = new mongoose.Schema(
  {
    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    initiatedBy: {
      type: String,
      enum: ['patient', 'caregiver'],
      default: 'patient',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    message: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// One pending request per pair per direction
CaregiverRequestSchema.index({ patientUserId: 1, caregiverId: 1, initiatedBy: 1 }, { unique: true });

export default mongoose.models.CaregiverRequest ||
  mongoose.model('CaregiverRequest', CaregiverRequestSchema);
