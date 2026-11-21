import { Router } from 'express';
import { z } from 'zod';
import Booking from '../models/Booking.js';
import RoomType from '../models/RoomType.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import { protect, allow } from '../middleware/auth.js';
import { freeRooms } from '../utils/availability.js';
import { priceStay } from '../utils/pricing.js';
import { checkCoupon } from '../utils/coupons.js';
import { notifyBranch } from '../utils/socket.js';
const r = Router();
r.use(protect, allow('customer'));

r.post('/', async (req, res) => {
  const d = z.object({ roomType: z.string(), checkIn: z.coerce.date(), checkOut: z.coerce.date(), guests: z.number().int().min(1), specialRequests: z.string().optional(), couponCode: z.string().optional() }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'Check your booking details' });
  const { roomType, checkIn, checkOut } = d.data;
  if (checkOut <= checkIn || checkIn < new Date(new Date().toDateString())) return res.status(400).json({ message: 'Choose valid dates' });
  const rt = await RoomType.findById(roomType);
  if (!rt) return res.status(404).json({ message: 'Room type not found' });
  if (d.data.guests > rt.capacity) return res.status(400).json({ message: `This room sleeps ${rt.capacity}` });
  if ((await freeRooms(roomType, checkIn, checkOut)) < 1) return res.status(409).json({ message: 'No rooms left for those dates' });

  const { subtotal, nights } = await priceStay(rt, checkIn, checkOut);
  let discount = 0, couponCode;
  if (d.data.couponCode) {
    try {
      const c = await checkCoupon(d.data.couponCode, rt.branch, subtotal);
      const ok = await Coupon.updateOne({ _id: c.coupon._id, $or: [{ maxUses: 0 }, { $expr: { $lt: ['$used', '$maxUses'] } }] }, { $inc: { used: 1 } });
      if (!ok.modifiedCount) throw new Error('This coupon has been fully used');
      discount = c.discount; couponCode = c.coupon.code;
    } catch (e) { return res.status(400).json({ message: e.message }); }
  }
  const total = subtotal - discount;
  const booking = await Booking.create({
    roomType, checkIn, checkOut, guests: d.data.guests, specialRequests: d.data.specialRequests,
    customer: req.user._id, branch: rt.branch, nights, subtotal, discount, couponCode, total,
    paymentStatus: total === 0 ? 'paid' : 'unpaid', timeline: [{ status: 'pending', by: req.user._id }],
  });
  await notifyBranch(rt.branch, { title: 'New booking', message: `${req.user.name} booked ${rt.name} (${booking.reference})`, link: `/manager?ref=${booking.reference}` });
  res.status(201).json(booking);
});
r.get('/mine', async (req, res) => {
  const list = await Booking.find({ customer: req.user._id }).sort('-createdAt').populate('branch', 'name city address').populate('roomType', 'name').populate('room', 'number').lean();
  const done = new Set((await Review.find({ booking: { $in: list.map((b) => b._id) } }, 'booking')).map((x) => String(x.booking)));
  res.json(list.map((b) => ({ ...b, reviewed: done.has(String(b._id)) })));
});
r.get('/:reference', async (req, res) => {
  const b = await Booking.findOne({ reference: req.params.reference, customer: req.user._id }).populate('branch roomType room');
  b ? res.json(b) : res.status(404).json({ message: 'Booking not found' });
});
r.patch('/:id/cancel', async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
  if (!b || !['pending', 'confirmed'].includes(b.status)) return res.status(400).json({ message: 'This booking can no longer be cancelled' });
  b.status = 'cancelled'; b.timeline.push({ status: 'cancelled', by: req.user._id }); await b.save();
  if (b.couponCode) await Coupon.updateOne({ code: b.couponCode, used: { $gt: 0 } }, { $inc: { used: -1 } });
  await notifyBranch(b.branch, { title: 'Booking cancelled', message: `${b.reference} was cancelled by the guest` });
  res.json(b);
});
export default r;
