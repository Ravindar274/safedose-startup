// src/lib/sendEmail.js
//
// Sends email via SendGrid.
// Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in your .env.

import sgMail from '@sendgrid/mail';

export async function sendEmail(to, subject, htmlBody) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from   = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey) {
    console.warn('[Email] SENDGRID_API_KEY not set — skipping email to', to);
    return;
  }
  if (!from) {
    console.warn('[Email] SENDGRID_FROM_EMAIL not set — skipping email to', to);
    return;
  }

  sgMail.setApiKey(apiKey);

  try {
    await sgMail.send({ to, from: { email: from, name: 'SafeDose' }, subject, html: htmlBody });
    console.log(`[Email] Sent to ${to}: "${subject}"`);
  } catch (err) {
    const detail = err.response?.body?.errors?.[0]?.message ?? err.message;
    console.error(`[Email] Failed to send to ${to}:`, detail);
  }
}
