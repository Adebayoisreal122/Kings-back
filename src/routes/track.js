import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Coupon from '../models/Coupon.js';
import { findGuestBooking, publicBooking } from '../utils/guestAccess.js';
import { paystack } from '../utils/paystack.js';
import { settle } from '../utils/payments.js';
import { notifyBranch } from '../utils/socket.js';
import { buildTicket } from '../utils/ticket.js';
const r = Router();
r.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Please wait a few minutes.' } }));
const proof = (req) => ({ t: req.query.t || req.body?.t, phone: req.query.phone || req.body?.phone });
const notFound = (res) => res.status(404).json({ message: 'We could not find a booking with those details' });

r.get('/:reference', async (req, res) => {
  const b = await findGuestBooking(req.params.reference, proof(req));
  b ? res.json(await publicBooking(b)) : notFound(res);
});
// Printable check-in ticket (PDF) with a QR code staff can scan. Only available once the booking is paid.
r.get('/:reference/ticket.pdf', async (req, res) => {
  const b = await findGuestBooking(req.params.reference, proof(req));
  if (!b) return notFound(res);
  if (b.status === 'cancelled') return res.status(400).json({ message: 'This booking was cancelled, so there is no ticket' });
  if (b.paymentStatus !== 'paid') return res.status(403).json({ message: 'Your check-in ticket is available once your payment is received. Please pay online first.' });
  const pdf = await buildTicket(b);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="kings-apartment-ticket-${b.reference}.pdf"`, 'Cache-Control': 'private, no-store' }).send(pdf);
});
// Start a Paystack payment for this booking
r.post('/:reference/pay', async (req, res) => {
  const b = await findGuestBooking(req.params.reference, proof(req));
  if (!b) return notFound(res);
  if (b.paymentStatus !== 'unpaid' || b.status === 'cancelled') return res.status(400).json({ message: 'This booking does not need a payment' });
  const out = await paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({
    email: b.guest.email || `${b.guest.phone}@guest.kingsapartment.com`, // Paystack needs an email; guests may not give one
    amount: b.total * 100, currency: 'NGN', reference: `${b.reference}-${Date.now()}`,
    callback_url: `${process.env.CLIENT_URL}/track?ref=${b.reference}&t=${b.accessToken}`, metadata: { bookingId: String(b._id) },
  }) });
  if (!out.status) return res.status(502).json({ message: 'Payment could not start. Try again.' });
  res.json({ url: out.data.authorization_url });
});
// Guest comes back from Paystack: confirm the payment
r.get('/:reference/verify', async (req, res) => {
  const b = await findGuestBooking(req.params.reference, proof(req));
  if (!b) return notFound(res);
  const out = await paystack(`/transaction/verify/${encodeURIComponent(req.query.payref || '')}`);
  await settle(out.data);
  res.json(await publicBooking(await findGuestBooking(req.params.reference, proof(req))));
});
r.post('/:reference/cancel', async (req, res) => {
  const b = await findGuestBooking(req.params.reference, proof(req));
  if (!b) return notFound(res);
  if (!['pending', 'confirmed'].includes(b.status)) return res.status(400).json({ message: 'This booking can no longer be cancelled' });
  if (b.paymentStatus === 'paid') return res.status(400).json({ message: `This booking is paid. Please call ${b.branch?.phone || 'the branch'} to cancel and arrange your refund.` });
  b.status = 'cancelled'; b.timeline.push({ status: 'cancelled' }); await b.save();
  if (b.couponCode) await Coupon.updateOne({ code: b.couponCode, used: { $gt: 0 } }, { $inc: { used: -1 } });
  await notifyBranch(b.branch._id, { title: 'Booking cancelled', message: `${b.reference} was cancelled by the guest`, sms: `Booking ${b.reference} (${b.guest.name}) was cancelled by the guest.` });
  res.json(await publicBooking(b));
});
r.post('/:reference/review', async (req, res) => {
  const b = await findGuestBooking(req.params.reference, proof(req));
  if (!b) return notFound(res);
  const d = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'Choose a rating from 1 to 5' });
  if (b.status !== 'checked_out') return res.status(400).json({ message: 'You can review your stay after you check out' });
  try { await Review.create({ ...d.data, booking: b._id, guestName: b.guest.name, branch: b.branch._id }); res.status(201).json(await publicBooking(b)); }
  catch (e) { res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'You already reviewed this stay' : 'Something went wrong' }); }
});
export default r;
