import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import RoomType from '../models/RoomType.js';
import { priceStay } from '../utils/pricing.js';
import { checkCoupon } from '../utils/coupons.js';
const r = Router();
r.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));
// Guests preview a coupon before booking (applied after any long-stay discount).
r.post('/validate', async (req, res) => {
  try {
    const rt = await RoomType.findById(req.body.roomType);
    if (!rt) return res.status(404).json({ message: 'Room type not found' });
    const p = await priceStay(rt, new Date(req.body.checkIn), new Date(req.body.checkOut));
    const { coupon, discount } = await checkCoupon(req.body.code, rt.branch, p.net);
    res.json({ code: coupon.code, discount, total: p.net - discount });
  } catch (e) { res.status(400).json({ message: e.message }); }
});
export default r;
