import 'dotenv/config';
import { connectDB } from './config/db.js';
import mongoose from 'mongoose';
import User from './models/User.js';
import Branch from './models/Branch.js';
import RoomType from './models/RoomType.js';
import Room from './models/Room.js';
import Coupon from './models/Coupon.js';
import StayDiscount from './models/StayDiscount.js';

await connectDB();
await Promise.all([User, Branch, RoomType, Room, Coupon, StayDiscount].map((m) => m.deleteMany()));
const amenities = ['Wi-Fi', 'Power 24/7', 'Parking', 'Security'];
const [ho, yaba] = await Branch.create([
  { name: "The King's Apartment, Ebute Metta (Head Office)", area: 'Ebute Metta', city: 'Lagos', state: 'Lagos', address: '13 Brickfield Street, Ebute Metta, Lagos', isHeadOffice: true, amenities },
  { name: "The King's Apartment, Yaba", area: 'Yaba', city: 'Lagos', state: 'Lagos', address: '12 Anthony Ajayi Street, Onike, Yaba, Lagos', amenities },
]);
// Room counts are placeholders. Set the real numbers under Admin > Rooms & rates.
const plan = [
  { branch: ho, name: 'Classic Studio', price: 50000, capacity: 2, numbers: ['101', '102', '103', '104'] },
  { branch: ho, name: 'Executive Suite', price: 70000, capacity: 3, numbers: ['201', '202'] },
  { branch: yaba, name: 'Classic Studio', price: 60000, capacity: 2, numbers: ['101', '102', '103', '104'] },
];
for (const p of plan) {
  const rt = await RoomType.create({ branch: p.branch._id, name: p.name, pricePerNight: p.price, capacity: p.capacity, totalRooms: p.numbers.length });
  await Room.insertMany(p.numbers.map((number) => ({ branch: p.branch._id, roomType: rt._id, number })));
}
await StayDiscount.create({ name: 'Weekly stay (7+ nights)', minNights: 7, percent: 10 });
await User.create([
  { name: 'Head Office', email: 'admin@kingsapartment.com', password: 'Admin12345', role: 'admin' },
  { name: 'Ebute Metta Manager', email: 'ebutemetta@kingsapartment.com', password: 'Manager12345', role: 'branch_manager', branch: ho._id },
  { name: 'Yaba Manager', email: 'yaba@kingsapartment.com', password: 'Manager12345', role: 'branch_manager', branch: yaba._id },
]);
console.log('Seeded. Set each manager\'s phone number under Admin > Managers so booking SMS alerts reach them, and change the passwords before going live.');
await mongoose.disconnect();
