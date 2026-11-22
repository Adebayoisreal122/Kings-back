import crypto from 'crypto';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import { normalizePhone } from './phone.js';
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// A guest proves it is their booking with the link token, or with the reference plus the phone number used to book.
export async function findGuestBooking(reference, { t, phone }) {
  const b = await Booking.findOne({ reference: String(reference || '').trim().toUpperCase() }).select('+accessToken')
    .populate('branch', 'name address phone checkInTime checkOutTime').populate('roomType', 'name').populate('room', 'number');
  if (!b) return null;
  const okToken = t && same(t, b.accessToken);
  const okPhone = phone && normalizePhone(phone) === b.guest.phone;
  return okToken || okPhone ? b : null;
}
export async function publicBooking(b) {
  return {
    reference: b.reference, status: b.status, paymentStatus: b.paymentStatus, guestName: b.guest.name,
    branch: b.branch, roomType: b.roomType?.name, room: b.room?.number, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, nights: b.nights,
    subtotal: b.subtotal, stayDiscount: b.stayDiscount, stayDiscountPercent: b.stayDiscountPercent, discount: b.discount, couponCode: b.couponCode, total: b.total,
    timeline: b.timeline, reviewed: !!(await Review.exists({ booking: b._id })),
  };
}
