import { normalizePhone } from './phone.js';
// Sends an SMS through Termii. Never throws: a failed SMS must not break a booking.
export async function sendSms(to, text) {
  const num = normalizePhone(to);
  if (!num) return false;
  const { TERMII_API_KEY, TERMII_SENDER_ID, TERMII_CHANNEL = 'generic', TERMII_BASE_URL = 'https://api.ng.termii.com/api' } = process.env;
  if (!TERMII_API_KEY || !TERMII_SENDER_ID) { console.log(`[sms not sent: no Termii keys] to ${num}: ${text}`); return false; }
  try {
    const res = await fetch(`${TERMII_BASE_URL}/sms/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TERMII_API_KEY, to: num, from: TERMII_SENDER_ID, sms: text, type: 'plain', channel: TERMII_CHANNEL }),
    });
    if (!res.ok) console.error('SMS failed', res.status, await res.text());
    return res.ok;
  } catch (e) { console.error('SMS error', e.message); return false; }
}
export const naira = (n) => 'NGN ' + Number(n || 0).toLocaleString('en-NG'); // plain ASCII keeps SMS cheap
