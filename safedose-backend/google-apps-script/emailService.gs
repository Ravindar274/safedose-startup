/**
 * SafeDose — Email Notification Service
 * Google Apps Script Web App
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to script.google.com and create a new project.
 * 2. Paste this entire file into the editor.
 * 3. Click Deploy → New deployment → Web app.
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone
 * 4. Click Deploy, authorize when prompted.
 * 5. Copy the Web app URL.
 * 6. Add it to your backend .env:
 *       APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
 * 7. Restart the backend server.
 *
 * The sending Google account's address will appear as the From address.
 * For a custom "From" display name, use the replyTo field.
 */

// ── POST handler ─────────────────────────────────────────────
function doPost(e) {
  try {
    var data    = JSON.parse(e.postData.contents);
    var to      = data.to;
    var subject = data.subject;
    var body    = data.body;

    if (!to || !subject || !body) {
      return jsonResponse({ error: 'Missing required fields: to, subject, body' }, 400);
    }

    // Validate email format
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return jsonResponse({ error: 'Invalid email address: ' + to }, 400);
    }

    MailApp.sendEmail({
      to:       to,
      subject:  subject,
      htmlBody: body,
      replyTo:  'noreply@safedose.app',
      name:     'SafeDose Notifications',
    });

    return jsonResponse({ success: true, message: 'Email sent to ' + to });

  } catch (err) {
    Logger.log('SafeDose email error: ' + err.toString());
    return jsonResponse({ error: err.toString() }, 500);
  }
}

// ── GET handler (health check) ────────────────────────────────
function doGet(e) {
  return jsonResponse({ status: 'SafeDose Email Service is running' });
}

// ── Helper ───────────────────────────────────────────────────
function jsonResponse(obj, statusCode) {
  var output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
