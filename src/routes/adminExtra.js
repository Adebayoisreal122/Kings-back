import { Router } from 'express';
import { z } from 'zod';
import RoomType from '../models/RoomType.js';
import Room from '../models/Room.js';
import RateRule from '../models/RateRule.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import StayDiscount from '../models/StayDiscount.js';
import Booking from '../models/Booking.js';
import { protect, allow } from '../middleware/auth.js';
import { bookingsCsv } from '../utils/report.js';
const r = Router();
r.use(protect, allow('admin'));
const syncCount = (roomType) => Room.countDocuments({ roomType }).then((n) => RoomType.findByIdAndUpdate(roomType, { totalRooms: n }));
const bad = (res, m = 'Check the details and try again') => res.status(400).json({ message: m });

// Room types
r.get('/room-types', async (req, res) => res.json(await RoomType.find(req.query.branch ? { branch: req.query.branch } : {}).lean()));
r.delete('/room-types/:id', async (req, res) => {
  if (await Booking.exists({ roomType: req.params.id, status: { $in: ['pending', 'confirmed', 'checked_in'] } })) return res.status(409).json({ message: 'This room type has active bookings' });
  await Room.deleteMany({ roomType: req.params.id }); await RoomType.findByIdAndDelete(req.params.id); res.json({ ok: true });
});
// Individual rooms
r.get('/rooms', async (req, res) => res.json(await Room.find(req.query.branch ? { branch: req.query.branch } : {}).populate('roomType', 'name').sort('number')));
r.post('/rooms', async (req, res) => {
  const d = z.object({ branch: z.string(), roomType: z.string(), numbers: z.array(z.string().min(1)).min(1).max(100) }).safeParse(req.body);
  if (!d.success) return bad(res);
  const have = new Set((await Room.find({ branch: d.data.branch }, 'number')).map((x) => x.number));
  const fresh = [...new Set(d.data.numbers)].filter((n) => !have.has(n));
  await Room.insertMany(fresh.map((number) => ({ branch: d.data.branch, roomType: d.data.roomType, number })));
  await syncCount(d.data.roomType);
  res.status(201).json({ added: fresh.length, skipped: d.data.numbers.length - fresh.length });
});
r.delete('/rooms/:id', async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ message: 'Room not found' });
  if (room.status === 'occupied') return res.status(409).json({ message: 'A guest is in this room' });
  await room.deleteOne(); await syncCount(room.roomType); res.json({ ok: true });
});
// Rates
const rule = z.object({ branch: z.string(), roomType: z.string().nullable().optional(), name: z.string().min(2), startDate: z.coerce.date(), endDate: z.coerce.date(), mode: z.enum(['percent', 'set']), value: z.number(), weekendsOnly: z.boolean().optional() });
r.get('/rate-rules', async (req, res) => res.json(await RateRule.find(req.query.branch ? { branch: req.query.branch } : {}).populate('roomType', 'name').sort('-startDate')));
r.post('/rate-rules', async (req, res) => {
  const d = rule.safeParse(req.body);
  if (!d.success || d.data.endDate < d.data.startDate || (d.data.mode === 'set' && d.data.value < 0)) return bad(res, 'Check the dates and price');
  res.status(201).json(await RateRule.create({ ...d.data, roomType: d.data.roomType || null }));
});
r.patch('/rate-rules/:id', async (req, res) => res.json(await RateRule.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true })));
r.delete('/rate-rules/:id', async (req, res) => { await RateRule.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
// Long-stay discounts
const stay = z.object({ branch: z.string().nullable().optional(), roomType: z.string().nullable().optional(), name: z.string().min(2), minNights: z.number().int().min(2).max(365), percent: z.number().min(1).max(90) });
r.get('/stay-discounts', async (_req, res) => res.json(await StayDiscount.find().populate('branch', 'name').populate('roomType', 'name').sort('minNights')));
r.post('/stay-discounts', async (req, res) => {
  const d = stay.safeParse(req.body);
  if (!d.success) return bad(res, 'Check the number of nights and the percent');
  res.status(201).json(await StayDiscount.create({ ...d.data, branch: d.data.branch || null, roomType: d.data.roomType || null }));
});
r.patch('/stay-discounts/:id', async (req, res) => res.json(await StayDiscount.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true })));
r.delete('/stay-discounts/:id', async (req, res) => { await StayDiscount.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
// Coupons
const coupon = z.object({ code: z.string().min(3).max(20), type: z.enum(['percent', 'fixed']), value: z.number().min(1), minTotal: z.number().min(0).optional(), maxUses: z.number().int().min(0).optional(), branch: z.string().nullable().optional(), validFrom: z.string().optional(), validTo: z.string().optional() });
r.get('/coupons', async (_req, res) => res.json(await Coupon.find().populate('branch', 'name').sort('-createdAt')));
r.post('/coupons', async (req, res) => {
  const d = coupon.safeParse(req.body);
  if (!d.success || (d.data.type === 'percent' && d.data.value > 100)) return bad(res, 'Check the coupon details');
  try {
    res.status(201).json(await Coupon.create({ ...d.data, branch: d.data.branch || undefined, validFrom: d.data.validFrom ? new Date(d.data.validFrom) : undefined, validTo: d.data.validTo ? new Date(d.data.validTo + 'T23:59:59.999Z') : undefined }));
  } catch (e) { res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'That code already exists' : 'Something went wrong' }); }
});
r.patch('/coupons/:id', async (req, res) => res.json(await Coupon.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true })));
r.delete('/coupons/:id', async (req, res) => { await Coupon.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
// Reviews moderation
r.get('/reviews', async (_req, res) => res.json(await Review.find().sort('-createdAt').limit(200).populate('branch', 'name')));
r.patch('/reviews/:id', async (req, res) => res.json(await Review.findByIdAndUpdate(req.params.id, { hidden: !!req.body.hidden }, { new: true })));
// Export
r.get('/reports/bookings.csv', async (req, res) => {
  const csv = await bookingsCsv({ branch: req.query.branch, from: req.query.from, to: req.query.to });
  res.type('text/csv').attachment('bookings.csv').send(csv);
});
export default r;
