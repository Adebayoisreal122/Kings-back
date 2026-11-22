import RateRule from '../models/RateRule.js';
import StayDiscount from '../models/StayDiscount.js';
// Price a stay night by night, applying any active rate rules (seasonal / weekend).
export async function priceStay(roomType, checkIn, checkOut) {
  const rules = await RateRule.find({
    branch: roomType.branch, active: true,
    startDate: { $lte: checkOut }, endDate: { $gte: checkIn },
    $or: [{ roomType: null }, { roomType: roomType._id }],
  }).sort('createdAt');
  let subtotal = 0, nights = 0;
  for (let d = new Date(checkIn); d < checkOut; d = new Date(+d + 864e5)) {
    let price = roomType.pricePerNight;
    const weekend = [5, 6].includes(d.getUTCDay());
    for (const r of rules) {
      if (d < r.startDate || d > r.endDate || (r.weekendsOnly && !weekend)) continue;
      price = r.mode === 'set' ? r.value : Math.round(price * (1 + r.value / 100));
    }
    subtotal += Math.max(0, price); nights++;
  }
  // Long-stay discount: the best matching rule wins
  const found = await StayDiscount.find({
    active: true, minNights: { $lte: nights },
    $and: [{ $or: [{ branch: null }, { branch: roomType.branch }] }, { $or: [{ roomType: null }, { roomType: roomType._id }] }],
  }).sort('-percent').limit(1);
  const stayDiscountPercent = found[0]?.percent || 0;
  const stayDiscount = Math.round((subtotal * stayDiscountPercent) / 100);
  return { subtotal, nights, stayDiscount, stayDiscountPercent, net: subtotal - stayDiscount };
}
