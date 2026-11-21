import 'dotenv/config';
import { connectDB } from './config/db.js';
import mongoose from 'mongoose';
import User from './models/User.js';
import Branch from './models/Branch.js';
import RoomType from './models/RoomType.js';
import Room from './models/Room.js';
import Coupon from './models/Coupon.js';

await connectDB();
await Promise.all([User, Branch, RoomType, Room, Coupon].map((m) => m.deleteMany()));
const data = [
  { name: "The King's Apartment, Ibadan", city: 'Ibadan', state: 'Oyo', address: 'Bodija, Ibadan' },
  { name: "The King's Apartment, Lagos", city: 'Lagos', state: 'Lagos', address: 'Lekki Phase 1, Lagos' },
];
const branches = await Branch.create(data.map((d) => ({ ...d, amenities: ['Wi-Fi', 'Power 24/7', 'Parking', 'Pool'] })));
for (const b of branches) {
  const types = await RoomType.create([
    { branch: b._id, name: 'Classic Studio', pricePerNight: 45000, capacity: 2, totalRooms: 4 },
    { branch: b._id, name: 'Executive Suite', pricePerNight: 85000, capacity: 3, totalRooms: 3 },
  ]);
  let n = 101;
  for (const t of types) for (let i = 0; i < t.totalRooms; i++) await Room.create({ branch: b._id, roomType: t._id, number: String(n++) });
}
await User.create([
  { name: 'Head Office', email: 'admin@kingsapartment.com', password: 'Admin12345', role: 'admin' },
  { name: 'Ibadan Manager', email: 'ibadan@kingsapartment.com', password: 'Manager12345', role: 'branch_manager', branch: branches[0]._id },
  { name: 'Lagos Manager', email: 'lagos@kingsapartment.com', password: 'Manager12345', role: 'branch_manager', branch: branches[1]._id },
]);
await Coupon.create({ code: 'WELCOME10', type: 'percent', value: 10 });
console.log('Seeded. Change these passwords before going live.');
await mongoose.disconnect();
