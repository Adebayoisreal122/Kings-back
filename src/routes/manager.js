import { Router } from 'express';
import Booking, { STATUSES } from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import { protect, allow } from '../middleware/auth.js';
import { notifyUser } from '../utils/socket.js';
import { bookingsCsv } from '../utils/report.js';
const r = Router();
r.use(protect, allow('branch_manager'));
const branchOf = (req) => req.user.branch;

r.get('/bookings', async (req, res) => {
  const q = { branch: branchOf(req) };
  if (req.query.status) q.status = req.query.status;
  res.json(await Booking.find(q).sort('-createdAt').populate('customer', 'name email phone').populate('roomType', 'name').populate('room', 'number'));
});
// Allowed moves keep the lodging flow honest.
const NEXT = { pending: ['confirmed', 'cancelled'], confirmed: ['checked_in', 'cancelled'], checked_in: ['checked_out'] };
r.patch('/bookings/:id/status', async (req, res) => {
  const { status, roomId } = req.body;
  const b = await Booking.findOne({ _id: req.params.id, branch: branchOf(req) });
  if (!b || !STATUSES.includes(status) || !NEXT[b.status]?.includes(status)) return res.status(400).json({ message: 'That status change is not allowed' });
  if (status === 'checked_in') {
    const room = await Room.findOne({ _id: roomId, branch: branchOf(req), roomType: b.roomType });
    if (!room) return res.status(400).json({ message: 'Assign a room of the booked type' });
    b.room = room._id; room.status = 'occupied'; await room.save();
  }
  if (status === 'checked_out' && b.room) await Room.findByIdAndUpdate(b.room, { status: 'cleaning' });
  b.status = status; b.timeline.push({ status, by: req.user._id }); await b.save();
  const copy = { confirmed: 'Your booking is confirmed', checked_in: 'Welcome! You are checked in', checked_out: 'Thanks for staying with us', cancelled: 'Your booking was cancelled' };
  await notifyUser(b.customer, { title: copy[status], message: `Booking ${b.reference}`, link: `/dashboard/bookings/${b.reference}` });
  res.json(b);
});
r.get('/rooms', async (req, res) => res.json(await Room.find({ branch: branchOf(req) }).populate('roomType', 'name')));
r.patch('/rooms/:id', async (req, res) => {
  res.json(await Room.findOneAndUpdate({ _id: req.params.id, branch: branchOf(req) }, { status: req.body.status }, { new: true }));
});
r.get('/stats', async (req, res) => {
  const branch = branchOf(req);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const start = new Date(today), end = new Date(+start + 864e5);
  const [pending, inHouse, arrivals, departures, revenue, rooms] = await Promise.all([
    Booking.countDocuments({ branch, status: 'pending' }),
    Booking.countDocuments({ branch, status: 'checked_in' }),
    Booking.countDocuments({ branch, status: 'confirmed', checkIn: { $gte: start, $lt: end } }),
    Booking.countDocuments({ branch, status: 'checked_in', checkOut: { $gte: start, $lt: end } }),
    Booking.aggregate([{ $match: { branch, paymentStatus: 'paid' } }, { $group: { _id: null, sum: { $sum: '$total' } } }]),
    Room.aggregate([{ $match: { branch } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({ pending, inHouse, arrivals, departures, revenue: revenue[0]?.sum ?? 0, rooms });
});
r.get('/report.csv', async (req, res) => {
  const csv = await bookingsCsv({ branch: branchOf(req), from: req.query.from, to: req.query.to });
  res.type('text/csv').attachment('branch-bookings.csv').send(csv);
});
export default r;
