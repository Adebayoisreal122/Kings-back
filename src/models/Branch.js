import mongoose from 'mongoose';
export default mongoose.model('Branch', new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String, required: true, index: true },
  area: String, // e.g. Yaba, shown on branch cards
  isHeadOffice: { type: Boolean, default: false },
  state: String,
  address: String,
  phone: String,
  description: String,
  amenities: [String],
  images: [String],
  geo: { lat: Number, lng: Number },
  checkInTime: { type: String, default: '14:00' },
  checkOutTime: { type: String, default: '12:00' },
  active: { type: Boolean, default: true },
}, { timestamps: true }));
