// src/models/User.js
// Authentication & identity only.
// Role-specific data lives in CaregiverProfile or Patient.

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true, minlength: 8 },
    role:      { type: String, enum: ['admin', 'patient', 'caregiver'], default: 'patient' },
    // active = normal, pending = awaiting admin approval (caregivers), rejected = denied
    status:    { type: String, enum: ['active', 'pending', 'rejected'], default: 'active' },
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
