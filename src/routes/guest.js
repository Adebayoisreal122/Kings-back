import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Booking from '../models/Booking.js';
import RoomType from '../models/RoomType.js';
import Coupon from '../models/Coupon.js';
import { freeRooms, HOLD } from '../utils/availability.js';
import { priceStay } from '../utils/pricing.js';
import { checkCoupon } from '../utils/coupons.js';
import { normalizePhone } from '../utils/phone.js';
import { notifyBranch } from '../utils/socket.js';
import { sendSms, naira } from '../utils/sms.js';
const r = Router();
r.use(rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many booking attempts. Please try again later.' } }));

// Guests book with just a name and phone number. No account, no password.
r.post('/bookings', async (req, res) => {
  const d = z.object({
    roomType: z.string(), checkIn: z.coerce.date(), checkOut: z.coerce.date(), guests: z.number().int().min(1).max(10),
    name: z.string().trim().min(2).max(80), phone: z.string(), email: z.string().email().optional().or(z.literal('')),
    specialRequests: z.string().max(500).optional(), couponCode: z.string().optional(),
  }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'Please check your details and try again' });
  const phone = normalizePhone(d.data.phone);
  if (!phone) return res.status(400).json({ message: 'Enter a valid phone number, for example 0803 123 4567' });
  const { roomType, checkIn, checkOut } = d.data;
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }));
  if (checkOut <= checkIn || checkIn < today || (checkOut - checkIn) / 864e5 > 90) return res.status(400).json({ message: 'Choose valid dates (up to 90 nights)' });
  const rt = await RoomType.findById(roomType);
  if (!rt) return res.status(404).json({ message: 'Room type not found' });
  if (d.data.guests > rt.capacity) return res.status(400).json({ message: `This room sleeps ${rt.capacity}` });
  const waiting = await Booking.countDocuments({ 'guest.phone': phone, status: 'pending', paymentStatus: 'unpaid', createdAt: { $gt: new Date(Date.now() - HOLD * 36e5) } });
  if (waiting >= 3) return res.status(429).json({ message: 'You already have bookings waiting for payment. Pay for one or cancel it first.' });
  if ((await freeRooms(roomType, checkIn, checkOut)) < 1) return res.status(409).json({ message: 'No rooms left for those dates' });

  const price = await priceStay(rt, checkIn, checkOut);
  let discount = 0, couponCode;
  if (d.data.couponCode) {
    try {
      const c = await checkCoupon(d.data.couponCode, rt.branch, price.net);
      const ok = await Coupon.updateOne({ _id: c.coupon._id, $or: [{ maxUses: 0 }, { $expr: { $lt: ['$used', '$maxUses'] } }] }, { $inc: { used: 1 } });
      if (!ok.modifiedCount) throw new Error('This coupon has been fully used');
      discount = c.discount; couponCode = c.coupon.code;
    } catch (e) { return res.status(400).json({ message: e.message }); }
  }
  const total = price.net - discount;
  const accessToken = crypto.randomBytes(16).toString('hex');
  const booking = await Booking.create({
    roomType, checkIn, checkOut, guests: d.data.guests, specialRequests: d.data.specialRequests, branch: rt.branch,
    guest: { name: d.data.name, phone, email: d.data.email || undefined }, accessToken,
    nights: price.nights, subtotal: price.subtotal, stayDiscount: price.stayDiscount, stayDiscountPercent: price.stayDiscountPercent, discount, couponCode, total,
    paymentStatus: total === 0 ? 'paid' : 'unpaid', timeline: [{ status: 'pending' }],
  });
  const day = (x) => x.toISOString().slice(0, 10);
  await notifyBranch(rt.branch, {
    title: 'New booking', message: `${booking.guest.name} booked ${rt.name} (${booking.reference})`, link: `/manager?ref=${booking.reference}`,
    sms: `New booking ${booking.reference}: ${booking.guest.name} ${phone}, ${rt.name}, ${day(checkIn)} to ${day(checkOut)} (${price.nights} nights), ${naira(total)}. Please confirm in the manager dashboard.`,
  });
  await sendSms(phone, `Kings Apartment: booking ${booking.reference} received for ${rt.name}, ${day(checkIn)} to ${day(checkOut)}. Total ${naira(total)}. Pay and track here: ${process.env.CLIENT_URL}/track?ref=${booking.reference}&t=${accessToken}`);
  res.status(201).json({ reference: booking.reference, accessToken, total, status: booking.status });
});
export default r;
