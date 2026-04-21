// src/routes/auth.js

import { Router } from 'express';
import User             from '../models/User.js';
import Patient          from '../models/Patient.js';
import CaregiverProfile from '../models/CaregiverProfile.js';
import { signToken } from '../lib/jwt.js';
import { sendEmail } from '../lib/sendEmail.js';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
  secure: process.env.NODE_ENV === 'production',
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// Creates a lean User record and a role-specific profile document.
// ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      firstName, lastName, email, password, confirmPassword, role,
      // Shared profile fields
      dateOfBirth, gender,
      // Caregiver-only fields
      qualification, experienceYears, specialization, availability, licenseId, languagesSpoken,
    } = req.body;

    if (!firstName || !lastName || !email || !password || !dateOfBirth || !gender) {
      return res.status(400).json({ error: 'Core fields including Date of Birth and Gender are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const allowedRoles = ['admin', 'patient', 'caregiver'];
    const assignedRole = allowedRoles.includes(role?.toLowerCase())
      ? role.toLowerCase()
      : 'patient';

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // ── 1. Create the lean User ───────────────────────────────
    const userStatus = assignedRole === 'caregiver' ? 'pending' : 'active';
    const user = await User.create({
      firstName, lastName, email, password,
      role: assignedRole,
      status: userStatus,
    });

    // ── 2. Create the role-specific profile ───────────────────
    if (assignedRole === 'patient') {
      await Patient.create({
        linkedUserId: user._id,
        firstName,
        lastName,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || '',
      });
    } else if (assignedRole === 'caregiver') {
      await CaregiverProfile.create({
        userId: user._id,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || '',
        qualification:   qualification   || '',
        experienceYears: experienceYears ? Number(experienceYears) : null,
        specialization:  specialization  || '',
        availability:    availability    || '',
        licenseId:       licenseId       || '',
        languagesSpoken: languagesSpoken || '',
      });
    }
    // Admin: no profile document needed

    // ── 3. Send welcome email (fire-and-forget) ───────────────
    const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    if (assignedRole === 'patient') {
      sendEmail(
        email,
        '👋 Welcome to SafeDose!',
        buildWelcomePatientEmail(firstName, APP_URL)
      ).catch(() => {});
    } else if (assignedRole === 'caregiver') {
      sendEmail(
        email,
        '👋 Welcome to SafeDose — Account Under Review',
        buildWelcomeCaregiverEmail(firstName, APP_URL)
      ).catch(() => {});

      const admins = await User.find({ role: 'admin', status: 'active' })
        .select('email firstName lastName')
        .lean();

      const pendingUrl = `${APP_URL}/admin/pending?search=${encodeURIComponent(email)}`;
      const notifySubject = `🚨 New caregiver signup pending approval: ${firstName} ${lastName}`;
      const notifyHtml = buildAdminCaregiverSignupEmail({
        firstName,
        lastName,
        email,
        qualification,
        specialization,
        experienceYears,
        licenseId,
        languagesSpoken,
        pendingUrl,
      }, APP_URL);

      admins.forEach((admin) => {
        if (!admin.email) return;
        sendEmail(admin.email, notifySubject, notifyHtml).catch(() => {});
      });
    }

    return res.status(201).json({ message: 'Account created successfully.', userId: user._id });
  } catch (err) {
    console.error('[REGISTER ERROR]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending admin approval.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account registration was rejected.' });
    }

    const token = signToken({
      userId: user._id.toString(),
      email:  user.email,
      role:   user.role,
    });

    res.cookie('safedose_token', token, COOKIE_OPTS);

    return res.json({
      message: 'Login successful.',
      role: user.role,
      user: {
        id:        user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie('safedose_token', { path: '/' });
  return res.json({ message: 'Logged out.' });
});

// ── Email template helpers ────────────────────────────────────

function emailShell(headerTitle, headerSub, bodyHtml, appUrl) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0d9488;padding:24px 32px;">
        <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">💊 SafeDose</p>
        <p style="margin:4px 0 0;color:#ccfbf1;font-size:13px;">${headerSub}</p>
      </td></tr>
      <tr><td style="padding:32px;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">SafeDose — Medication Safety Assistant &nbsp;|&nbsp; <a href="${appUrl}" style="color:#0d9488;text-decoration:none;">Open Dashboard</a></p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Do not reply to this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildWelcomePatientEmail(firstName, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Welcome, ${firstName}!</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">Your SafeDose patient account is ready. You can now:</p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
      <li>Track your daily medications and doses</li>
      <li>Browse and hire a caregiver</li>
      <li>Receive dose reminders by email and push notification</li>
    </ul>
    <a href="${appUrl}/patient/dashboard" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;">Go to my dashboard →</a>`;
  return emailShell('Welcome to SafeDose', 'Account Created', body, `${appUrl}/patient/dashboard`);
}

function buildWelcomeCaregiverEmail(firstName, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Welcome, ${firstName}!</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">Your SafeDose caregiver account has been created and is now <strong>pending admin review</strong>.</p>
    <table style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;width:100%;margin:0 0 20px;" cellpadding="14" cellspacing="0">
      <tr><td>
        <p style="margin:0;font-size:14px;color:#92400e;font-weight:bold;">⏳ What happens next?</p>
        <p style="margin:6px 0 0;font-size:13px;color:#92400e;">Our admin team will review your credentials and license details. You will receive an email once your account is approved or if any action is needed.</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;">Approval typically takes 1–2 business days. If you have questions, contact us through the platform.</p>`;
  return emailShell('Welcome to SafeDose', 'Caregiver Account — Pending Review', body, appUrl);
}

function buildAdminCaregiverSignupEmail(caregiver, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">New caregiver registration requires review</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">A caregiver has signed up and is waiting for approval.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px;color:#374151;">
      <tr><td style="padding:6px 0;font-weight:bold;">Name:</td><td style="padding:6px 0;">${caregiver.firstName} ${caregiver.lastName}</td></tr>
      <tr><td style="padding:6px 0;font-weight:bold;">Email:</td><td style="padding:6px 0;">${caregiver.email}</td></tr>
      <tr><td style="padding:6px 0;font-weight:bold;">Qualification:</td><td style="padding:6px 0;">${caregiver.qualification || '—'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:bold;">Specialization:</td><td style="padding:6px 0;">${caregiver.specialization || '—'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:bold;">Experience:</td><td style="padding:6px 0;">${caregiver.experienceYears != null && caregiver.experienceYears !== '' ? `${caregiver.experienceYears} years` : '—'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:bold;">License ID:</td><td style="padding:6px 0;">${caregiver.licenseId || '—'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:bold;">Languages:</td><td style="padding:6px 0;">${caregiver.languagesSpoken || '—'}</td></tr>
    </table>
    <a href="${caregiver.pendingUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;">Review and Approve Caregiver →</a>
    <p style="margin:14px 0 0;font-size:12px;color:#6b7280;">This link opens Pending Approvals with this caregiver pre-filtered.</p>`;

  return emailShell('Admin Alert', 'New Caregiver Pending Approval', body, `${appUrl}/admin/pending`);
}

export default router;
