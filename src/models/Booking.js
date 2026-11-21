import mongoose from 'mongoose';
export const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
const schema = new mongoose.Schema({
  reference: { type: String, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' }, // assigned by manager
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, default: 1 },
  nights: Number,
  subtotal: Number,
  discount: { type: Number, default: 0 },
  couponCode: String,
  total: Number,
  specialRequests: String,
  status: { type: String, enum: STATUSES, default: 'pending', index: true },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
  paymentRef: String,
  timeline: [{ status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
}, { timestamps: true });
schema.pre('validate', function (next) {
  if (!this.reference) this.reference = 'KA-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  next();
});
export default mongoose.model('Booking', schema);
