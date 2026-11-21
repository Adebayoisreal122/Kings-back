import { Router } from 'express';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';
const r = Router();
r.use(protect);
r.get('/', async (req, res) => res.json(await Notification.find({ user: req.user._id }).sort('-createdAt').limit(50)));
r.patch('/read-all', async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); });
export default r;
