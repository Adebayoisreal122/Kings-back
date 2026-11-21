import { Router } from 'express';
import RoomType from '../models/RoomType.js';
import { protect, allow } from '../middleware/auth.js';
import { priceStay } from '../utils/pricing.js';
import { checkCoupon } from '../utils/coupons.js';
const r = Router();
// Guest previews a coupon before booking.
r.post('/validate', protect, allow('customer'), async (req, res) => {
  try {
    const rt = await RoomType.findById(req.body.roomType);
    if (!rt) return res.status(404).json({ message: 'Room type not found' });
    const { subtotal } = await priceStay(rt, new Date(req.body.checkIn), new Date(req.body.checkOut));
    const { coupon, discount } = await checkCoupon(req.body.code, rt.branch, subtotal);
    res.json({ code: coupon.code, subtotal, discount, total: subtotal - discount });
  } catch (e) { res.status(400).json({ message: e.message }); }
});
export default r;
