import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
const r = Router();
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, branch: u.branch?._id ?? u.branch, branchName: u.branch?.name });

r.post('/register', async (req, res) => {
  const d = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), password: z.string().min(8) }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'Check your details and try again' });
  if (await User.findOne({ email: d.data.email.toLowerCase() })) return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({ ...d.data, role: 'customer' }); // customers only; staff are created by admin
  res.status(201).json({ token: sign(user), user: pub(user) });
});
r.post('/login', async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() }).select('+password').populate('branch', 'name');
  if (!user || !(await user.matches(req.body.password || ''))) return res.status(401).json({ message: 'Wrong email or password' });
  if (!user.active) return res.status(403).json({ message: 'This account has been deactivated. Contact head office.' });
  res.json({ token: sign(user), user: pub(user) });
});
r.get('/me', protect, async (req, res) => { await req.user.populate('branch', 'name'); res.json({ user: pub(req.user) }); });
r.patch('/me', protect, async (req, res) => {
  const d = z.object({ name: z.string().min(2).optional(), phone: z.string().max(30).optional() }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'Check your details and try again' });
  Object.assign(req.user, d.data); await req.user.save();
  await req.user.populate('branch', 'name'); res.json({ user: pub(req.user) });
});
r.post('/password', protect, async (req, res) => {
  const d = z.object({ current: z.string(), next: z.string().min(8) }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'The new password needs 8 or more characters' });
  const u = await User.findById(req.user._id).select('+password');
  if (!(await u.matches(d.data.current))) return res.status(400).json({ message: 'Your current password is wrong' });
  u.password = d.data.next; await u.save(); res.json({ ok: true });
});
export default r;
