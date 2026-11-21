import { Router } from 'express';
import { z } from 'zod';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import { protect, allow } from '../middleware/auth.js';
const r = Router();
r.get('/', async (req, res) => {
  const q = { hidden: false };
  if (req.query.branch) q.branch = req.query.branch;
  const list = await Review.find(q).sort('-createdAt').limit(Math.min(+req.query.limit || 50, 50)).populate('customer', 'name').populate('branch', 'name').lean();
  res.json(list.map((v) => ({ _id: v._id, rating: v.rating, comment: v.comment, name: (v.customer?.name || 'Guest').split(' ')[0], branchName: v.branch?.name, createdAt: v.createdAt })));
});
r.post('/', protect, allow('customer'), async (req, res) => {
  const d = z.object({ booking: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'Choose a rating from 1 to 5' });
  const b = await Booking.findOne({ _id: d.data.booking, customer: req.user._id, status: 'checked_out' });
  if (!b) return res.status(400).json({ message: 'You can review a stay after you check out' });
  try { res.status(201).json(await Review.create({ ...d.data, booking: b._id, customer: req.user._id, branch: b.branch })); }
  catch (e) { res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'You already reviewed this stay' : 'Something went wrong' }); }
});
export default r;
