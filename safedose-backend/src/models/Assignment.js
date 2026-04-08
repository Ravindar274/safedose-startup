// src/models/Assignment.js

import mongoose from 'mongoose';

/**
 * Assignment links a caregiver (User) to a patient (Patient).
 *
 * role:
 *   'owner'    — caregiver created this patient profile (no SafeDose account).
 *                Deleting the assignment also deletes the Patient document.
 *   'caregiver' — caregiver linked an existing registered patient.
 *                Deleting the assignment only removes the caregiver's access.
 */
const AssignmentSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'caregiver'],
      default: 'caregiver',
    },
  },
  { timestamps: true }
);

// A caregiver can only be assigned to a patient once
AssignmentSchema.index({ caregiverId: 1, patientId: 1 }, { unique: true });

export default mongoose.models.Assignment ||
  mongoose.model('Assignment', AssignmentSchema);
