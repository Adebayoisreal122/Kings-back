import { Router } from 'express';
import crypto from 'crypto';
import { settle } from '../utils/payments.js';
const r = Router();
// Mounted with express.raw so the signature is checked against the exact bytes Paystack sent.
r.post('/', async (req, res) => {
  const sig = Buffer.from(String(req.headers['x-paystack-signature'] || ''));
  const hash = Buffer.from(crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.body).digest('hex'));
  if (sig.length !== hash.length || !crypto.timingSafeEqual(sig, hash)) return res.sendStatus(401);
  res.sendStatus(200); // acknowledge fast, then process
  try { const evt = JSON.parse(req.body.toString()); if (evt.event === 'charge.success') await settle(evt.data); } catch (e) { console.error('webhook', e); }
});
export default r;
