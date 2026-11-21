import { Router } from 'express';
import Booking from '../models/Booking.js';
import { protect, allow } from '../middleware/auth.js';
import { settle } from '../utils/payments.js';
const r = Router();
r.use(protect, allow('customer'));
const paystack = (path, opts = {}) => fetch(`https://api.paystack.co${path}`, { ...opts, headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }).then((x) => x.json());

r.post('/initialize', async (req, res) => {
  const b = await Booking.findOne({ _id: req.body.bookingId, customer: req.user._id, paymentStatus: 'unpaid', status: { $ne: 'cancelled' } });
  if (!b) return res.status(404).json({ message: 'Booking not found' });
  const out = await paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({
    email: req.user.email, amount: b.total * 100, currency: 'NGN', reference: b.reference + '-' + Date.now(),
    callback_url: `${process.env.CLIENT_URL}/dashboard/bookings`, metadata: { bookingId: String(b._id) },
  }) });
  if (!out.status) return res.status(502).json({ message: 'Payment could not start. Try again.' });
  res.json(out.data);
});
r.get('/verify/:reference', async (req, res) => {
  const out = await paystack(`/transaction/verify/${req.params.reference}`);
  const b = await settle(out.data);
  if (!b || String(b.customer) !== String(req.user._id)) return res.status(400).json({ message: 'Payment not confirmed yet' });
  res.json(b);
});
export default r;
