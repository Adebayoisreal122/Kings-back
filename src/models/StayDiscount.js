import mongoose from 'mongoose';
// Long-stay discount: book at least `minNights` and get `percent` off the room total.
export default mongoose.model('StayDiscount', new mongoose.Schema({
  name: { type: String, required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },       // empty = every branch
  roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', default: null },   // empty = every room type
  minNights: { type: Number, required: true, min: 2 },
  percent: { type: Number, required: true, min: 1, max: 90 },
  active: { type: Boolean, default: true },
}, { timestamps: true }));
