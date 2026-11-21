import { Router } from 'express';
import PushSub from '../models/PushSub.js';
import { protect } from '../middleware/auth.js';
const r = Router();
r.get('/public-key', (_req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY || null }));
r.post('/subscribe', protect, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ message: 'Invalid subscription' });
  await PushSub.findOneAndUpdate({ endpoint }, { user: req.user._id, keys }, { upsert: true });
  res.json({ ok: true });
});
r.delete('/subscribe', protect, async (req, res) => { await PushSub.deleteOne({ endpoint: req.body.endpoint, user: req.user._id }); res.json({ ok: true }); });
export default r;
