import Booking from '../models/Booking.js';
// Guard against spreadsheet formula injection from guest-entered text.
const esc = (v) => {
  let s = v == null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export async function bookingsCsv({ branch, from, to }) {
  const q = {};
  if (branch) q.branch = branch;
  if (from || to) { q.checkIn = {}; if (from) q.checkIn.$gte = new Date(from); if (to) q.checkIn.$lte = new Date(to + 'T23:59:59.999Z'); }
  const list = await Booking.find(q).sort('checkIn').populate('branch', 'name').populate('roomType', 'name').populate('room', 'number').lean();
  const head = ['Reference', 'Booked on', 'Guest', 'Email', 'Phone', 'Branch', 'Room type', 'Room', 'Check in', 'Check out', 'Nights', 'Subtotal', 'Discounts', 'Coupon', 'Total', 'Status', 'Payment'];
  const rows = list.map((b) => [b.reference, day(b.createdAt), b.guest?.name, b.guest?.email, b.guest?.phone, b.branch?.name, b.roomType?.name, b.room?.number, day(b.checkIn), day(b.checkOut), b.nights, b.subtotal ?? b.total, (b.stayDiscount || 0) + (b.discount || 0), b.couponCode, b.total, b.status, b.paymentStatus]);
  return '\ufeff' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}
