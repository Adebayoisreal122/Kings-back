import { Router } from 'express';
import Branch from '../models/Branch.js';
import RoomType from '../models/RoomType.js';
import Review from '../models/Review.js';
import { freeRooms } from '../utils/availability.js';
import { priceStay } from '../utils/pricing.js';
import StayDiscount from '../models/StayDiscount.js';
const r = Router();
const ratings = async () => Object.fromEntries((await Review.aggregate([{ $match: { hidden: false } }, { $group: { _id: '$branch', avg: { $avg: '$rating' }, count: { $sum: 1 } } }])).map((x) => [String(x._id), { rating: Math.round(x.avg * 10) / 10, reviews: x.count }]));
r.get('/', async (req, res) => {
  const q = { active: true };
  if (req.query.city) q.city = new RegExp(`^${String(req.query.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const [branches, mins, rt] = await Promise.all([Branch.find(q).lean(), RoomType.aggregate([{ $group: { _id: '$branch', from: { $min: '$pricePerNight' } } }]), ratings()]);
  const map = Object.fromEntries(mins.map((m) => [String(m._id), m.from]));
  res.json(branches.map((b) => ({ ...b, priceFrom: map[String(b._id)] ?? null, ...(rt[String(b._id)] || { rating: null, reviews: 0 }) })));
});
r.get('/discounts/stay', async (_req, res) => res.json(await StayDiscount.find({ active: true }).populate('branch', 'name').populate('roomType', 'name').sort('minNights').lean()));
r.get('/featured/rooms', async (_req, res) => {
  const types = await RoomType.find().sort('-updatedAt').limit(30).populate('branch', 'name city active').lean();
  const live = types.filter((t) => t.branch?.active).sort((a, b) => (b.images?.length ? 1 : 0) - (a.images?.length ? 1 : 0)).slice(0, 6);
  res.json(live.map((t) => ({ _id: t._id, name: t.name, pricePerNight: t.pricePerNight, capacity: t.capacity, description: t.description, images: t.images || [], branch: { _id: t.branch._id, name: t.branch.name, city: t.branch.city } })));
});
r.get('/:id', async (req, res) => {
  const branch = await Branch.findById(req.params.id).lean();
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  const roomTypes = await RoomType.find({ branch: branch._id }).lean();
  const { checkIn, checkOut } = req.query;
  if (checkIn && checkOut) {
    const ci = new Date(checkIn), co = new Date(checkOut);
    for (const rt of roomTypes) { rt.available = await freeRooms(rt._id, ci, co); rt.quote = await priceStay(rt, ci, co); }
  }
  res.json({ ...branch, ...((await ratings())[String(branch._id)] || { rating: null, reviews: 0 }), roomTypes });
});
export default r;
