import { Router } from 'express';
import Review from '../models/Review.js';
const r = Router();
r.get('/', async (req, res) => {
  const q = { hidden: false };
  if (req.query.branch) q.branch = req.query.branch;
  const list = await Review.find(q).sort('-createdAt').limit(Math.min(+req.query.limit || 50, 50)).populate('branch', 'name').lean();
  res.json(list.map((v) => ({ _id: v._id, rating: v.rating, comment: v.comment, name: (v.guestName || 'Guest').split(' ')[0], branchName: v.branch?.name, createdAt: v.createdAt })));
});
export default r;
