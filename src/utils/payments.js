import Booking from '../models/Booking.js';
import { notifyBranch } from './socket.js';
// Mark a booking paid from a verified Paystack transaction. Safe to call twice (verify + webhook).
export async function settle(tx) {
  const id = tx?.metadata?.bookingId;
  if (!id || tx.status !== 'success' || tx.currency !== 'NGN') return null;
  const b = await Booking.findById(id);
  if (!b || tx.amount !== b.total * 100) return null;
  if (b.paymentStatus === 'paid') return b;
  const paid = await Booking.findOneAndUpdate({ _id: id, paymentStatus: 'unpaid' }, { paymentStatus: 'paid', paymentRef: tx.reference }, { new: true });
  if (paid) await notifyBranch(paid.branch, { title: 'Payment received', message: `${paid.reference} has been paid`, link: `/manager?ref=${paid.reference}` });
  return paid || b;
}
