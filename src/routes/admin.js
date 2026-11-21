import { Router } from 'express';
import { z } from 'zod';
import Branch from '../models/Branch.js';
import RoomType from '../models/RoomType.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { protect, allow } from '../middleware/auth.js';
const r = Router();
r.use(protect, allow('admin'));

r.get('/stats', async (_req, res) => {
  const [byBranch, totals, users] = await Promise.all([
    Booking.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$branch', bookings: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } } } }, { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } }, { $unwind: '$branch' }, { $project: { name: '$branch.name', bookings: 1, revenue: 1 } }]),
    Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    User.countDocuments({ role: 'customer' }),
  ]);
  res.json({ byBranch, totals, customers: users });
});
// Branches
r.get('/branches', async (_req, res) => res.json(await Branch.find()));
r.post('/branches', async (req, res) => res.status(201).json(await Branch.create(req.body)));
r.put('/branches/:id', async (req, res) => res.json(await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true })));
r.delete('/branches/:id', async (req, res) => res.json(await Branch.findByIdAndUpdate(req.params.id, { active: false }, { new: true }))); // soft delete
// Room types and rooms
r.post('/room-types', async (req, res) => res.status(201).json(await RoomType.create(req.body)));
r.put('/room-types/:id', async (req, res) => res.json(await RoomType.findByIdAndUpdate(req.params.id, req.body, { new: true })));
r.post('/rooms', async (req, res) => res.status(201).json(await Room.create(req.body)));
// Staff and customers
r.get('/users', async (req, res) => res.json(await User.find(req.query.role ? { role: req.query.role } : {}).populate('branch', 'name').sort('-createdAt')));
const staff = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, branch: u.branch, active: u.active });
r.post('/users', async (req, res) => {
  const d = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), password: z.string().min(8), role: z.enum(['branch_manager', 'admin']), branch: z.string().optional() }).safeParse(req.body);
  if (!d.success) return res.status(400).json({ message: 'Check the details. The password needs 8 or more characters.' });
  if (d.data.role === 'branch_manager' && !d.data.branch) return res.status(400).json({ message: 'Choose the branch this manager runs' });
  try { res.status(201).json(staff(await User.create(d.data))); }
  catch (e) { res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'That email is already in use' : 'Something went wrong' }); }
});
r.patch('/users/:id', async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u || u.role === 'customer') return res.status(404).json({ message: 'Staff member not found' });
  const { name, phone, branch, active, password } = req.body;
  if (active === false && String(u._id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot deactivate your own account' });
  if (password && password.length < 8) return res.status(400).json({ message: 'The password needs 8 or more characters' });
  if (name) u.name = name;
  if (phone !== undefined) u.phone = phone;
  if (branch && u.role === 'branch_manager') u.branch = branch;
  if (typeof active === 'boolean') u.active = active;
  if (password) u.password = password;
  await u.save(); res.json(staff(u));
});
r.get('/bookings', async (req, res) => {
  const q = {}; if (req.query.branch) q.branch = req.query.branch; if (req.query.status) q.status = req.query.status;
  res.json(await Booking.find(q).sort('-createdAt').limit(200).populate('customer', 'name email').populate('branch', 'name').populate('roomType', 'name'));
});
export default r;
