import Booking from '../models/Booking.js';
import { notifyBranch } from './socket.js';
import { sendSms, naira } from './sms.js';
// Mark a booking paid from a verified Paystack transaction. Safe to call twice (verify + webhook).
export async function settle(tx) {
  const id = tx?.metadata?.bookingId;
  if (!id || tx.status !== 'success' || tx.currency !== 'NGN') return null;
  const b = await Booking.findById(id);
  if (!b || tx.amount !== b.total * 100) return null;
  if (b.paymentStatus === 'paid') return b;
  const paid = await Booking.findOneAndUpdate({ _id: id, paymentStatus: 'unpaid' }, { paymentStatus: 'paid', paymentRef: tx.reference }, { new: true });
  if (paid) {
    await notifyBranch(paid.branch, { title: 'Payment received', message: `${paid.reference} has been paid`, link: `/manager?ref=${paid.reference}`, sms: `Payment of ${naira(paid.total)} received for booking ${paid.reference} (${paid.guest.name}).` });
    await sendSms(paid.guest.phone, `Kings Apartment: we received your payment of ${naira(paid.total)} for booking ${paid.reference}. Thank you!`);
  }
  return paid || b;
}
