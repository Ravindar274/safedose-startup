// src/models/User.js

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true, minlength: 8 },
    role:      { type: String, enum: ['admin', 'patient', 'caregiver'], default: 'patient' },
    status:    { type: String, enum: ['active', 'pending', 'rejected'], default: 'active' },
    dateOfBirth: { type: Date },
    gender: { type: String },
    caregiverProfile: {
      qualification: { type: String, trim: true },
      experienceYears: { type: Number },
      specialization: { type: String, trim: true },
      availability: { type: String, trim: true },
      licenseId: { type: String, trim: true },
      languagesSpoken: { type: String, trim: true }
    },
    notifications: {
      email:   { type: Boolean, default: false },
      desktop: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.models.User || mongoose.model('User', UserSchema);
