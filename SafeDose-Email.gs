/**
 * SafeDose — Google Apps Script Email Relay
 *
 * Deploy this as a Web App:
 *   Extensions → Apps Script → Deploy → New deployment
 *   Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Copy the deployment URL into your backend .env as:
 *   APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 *
 * The backend POSTs JSON:  { "to": "...", "subject": "...", "body": "<html>..." }
 * This script forwards it as an email and returns { "success": true }.
 *
 * Email types sent by SafeDose backend
 * ─────────────────────────────────────
 * 1.  Medication dose reminder          — patient, at scheduled time
 * 2.  Missed dose reminder              — patient, 30 min after scheduled time
 * 3.  Daily adherence miss summary      — patient + caregiver, end of day
 * 4.  Hire request invitation           — caregiver, with Accept / Decline links
 * 5.  Request accepted notification     — patient, when caregiver accepts
 * 6.  Request declined notification     — patient, when caregiver declines
 * 7.  Welcome email (patient)           — patient, on registration
 * 8.  Welcome + pending review          — caregiver, on registration
 * 9.  Account approved                  — caregiver, when admin approves
 * 10. Account rejected                  — caregiver, when admin rejects
 */

// ─────────────────────────────────────────────────────────────────
// GET — health check so you can verify the deployment is live
// Visit the web app URL in a browser to confirm it's working.
// ─────────────────────────────────────────────────────────────────
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status:  'ok',
      service: 'SafeDose Email Relay',
      time:    new Date().toISOString(),
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────────
// POST — receive email payload and send via MailApp
// ─────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    // Parse the request body sent by the Node.js backend
    var payload = JSON.parse(e.postData.contents);

    var to      = payload.to;
    var subject = payload.subject;
    var body    = payload.body;   // HTML string

    // Validate required fields
    if (!to || !subject || !body) {
      return jsonResponse({ error: 'Missing required fields: to, subject, body' }, 400);
    }

    // Validate email address format (basic sanity check)
    if (!isValidEmail(to)) {
      return jsonResponse({ error: 'Invalid email address: ' + to }, 400);
    }

    // Send the email
    // MailApp quota: 100 emails/day (consumer) or 1,500/day (Workspace)
    MailApp.sendEmail({
      to:       to,
      subject:  subject,
      htmlBody: body,
      name:     'SafeDose',
      // replyTo is intentionally omitted — these are transactional no-reply emails
    });

    // Log for debugging (visible in Apps Script → Executions)
    Logger.log('Email sent | to: %s | subject: %s', to, subject);

    return jsonResponse({ success: true, to: to, subject: subject });

  } catch (err) {
    Logger.log('Email failed: %s', err.message);
    return jsonResponse({ error: err.message }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Return a JSON ContentService output.
 * @param {Object}  data   — object to serialize
 * @param {number}  [status] — unused (Apps Script ignores HTTP status on responses)
 */
function jsonResponse(data, status) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Basic email format check */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─────────────────────────────────────────────────────────────────
// Manual test — run this function from the Apps Script editor
// to verify MailApp is working before wiring up the backend.
// ─────────────────────────────────────────────────────────────────
function testSendEmail() {
  var testTo      = Session.getActiveUser().getEmail(); // sends to yourself
  var testSubject = 'SafeDose Email Relay — Test';
  var testBody    = '<h2 style="color:#0d9488;">SafeDose</h2>'
    + '<p>If you received this, the Apps Script email relay is working correctly.</p>'
    + '<p style="color:#6b7280;font-size:12px;">Sent at: ' + new Date().toISOString() + '</p>';

  MailApp.sendEmail({
    to:       testTo,
    subject:  testSubject,
    htmlBody: testBody,
    name:     'SafeDose',
  });

  Logger.log('Test email sent to %s', testTo);
}
