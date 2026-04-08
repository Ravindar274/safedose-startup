// src/lib/sendEmail.js
//
// Sends email via a Google Apps Script web app.
// Set APPS_SCRIPT_URL in your .env to the deployed Apps Script URL.

export async function sendEmail(to, subject, htmlBody) {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) {
    console.warn('[Email] APPS_SCRIPT_URL not set — skipping email to', to);
    return;
  }
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to, subject, body: htmlBody }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    console.log(`[Email] Sent to ${to}: "${subject}"`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
  }
}
