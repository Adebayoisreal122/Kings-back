import Booking from '../models/Booking.js';
import RoomType from '../models/RoomType.js';
// Rooms of a type still free for [checkIn, checkOut)
export async function freeRooms(roomTypeId, checkIn, checkOut) {
  const rt = await RoomType.findById(roomTypeId);
  if (!rt) return 0;
  const taken = await Booking.countDocuments({
    roomType: roomTypeId,
    status: { $in: ['pending', 'confirmed', 'checked_in'] },
    checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn },
  });
  return Math.max(0, rt.totalRooms - taken);
}
