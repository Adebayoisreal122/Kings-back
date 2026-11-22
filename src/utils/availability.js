import Booking from '../models/Booking.js';
import RoomType from '../models/RoomType.js';
const HOLD_HOURS = 12; // an unpaid, unconfirmed request holds a room for 12 hours, then frees it
// Rooms of a type still free for [checkIn, checkOut)
export async function freeRooms(roomTypeId, checkIn, checkOut, excludeId) {
  const rt = await RoomType.findById(roomTypeId);
  if (!rt) return 0;
  const holdFrom = new Date(Date.now() - HOLD_HOURS * 36e5);
  const q = {
    roomType: roomTypeId, checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn },
    $or: [{ status: { $in: ['confirmed', 'checked_in'] } }, { status: 'pending', $or: [{ paymentStatus: 'paid' }, { createdAt: { $gt: holdFrom } }] }],
  };
  if (excludeId) q._id = { $ne: excludeId };
  return Math.max(0, rt.totalRooms - (await Booking.countDocuments(q)));
}
export const HOLD = HOLD_HOURS;
