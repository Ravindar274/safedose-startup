// src/models/CaregiverProfile.js
// Stores all caregiver-specific data that does not belong in the lean User model.
// One document per caregiver user (userId is unique).

import mongoose from 'mongoose';

const CaregiverProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Personal details
    dateOfBirth: { type: Date,   default: null },
    gender:      { type: String, default: '' },

    // Professional details
    qualification:    { type: String, trim: true, default: '' },
    experienceYears:  { type: Number, default: null },
    specialization:   { type: String, trim: true, default: '' },
    availability:     { type: String, trim: true, default: '' },
    licenseId:        { type: String, trim: true, default: '' },
    languagesSpoken:  { type: String, trim: true, default: '' },

    // Notification preferences
    notifications: {
      email:   { type: Boolean, default: false },
      desktop: { type: Boolean, default: false },
    },
    pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.CaregiverProfile ||
  mongoose.model('CaregiverProfile', CaregiverProfileSchema);
