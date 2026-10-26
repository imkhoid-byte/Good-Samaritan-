// Best-effort owner notifications. Both channels are optional: with no
// credentials configured, messages are logged and the app keeps working
// (owners still see everything on their private tag page).
//
//   Email: RESEND_API_KEY, NOTIFY_FROM_EMAIL
//   SMS:   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

export interface Recipient {
  email?: string | null;
  phone?: string | null;
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !from) {
    console.log(`[notify:email:disabled] to=${to} subject="${subject}"`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendSms(to: string, text: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[notify:sms:disabled] to=${to} body="${text.slice(0, 60)}…"`);
    return;
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ To: to, From: from, Body: text }).toString()
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

// Awaited by callers so serverless functions don't freeze mid-request,
// but failures never surface to the person who triggered the notification.
export async function notify(to: Recipient, subject: string, text: string): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (to.email) jobs.push(sendEmail(to.email, subject, text));
  if (to.phone) jobs.push(sendSms(to.phone, `${subject}\n${text}`));
  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === 'rejected') console.error('[notify] failed:', r.reason);
  }
}
