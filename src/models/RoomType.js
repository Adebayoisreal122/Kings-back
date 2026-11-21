import mongoose from 'mongoose';
export default mongoose.model('RoomType', new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  name: { type: String, required: true },
  pricePerNight: { type: Number, required: true }, // NGN
  capacity: { type: Number, default: 2 },
  totalRooms: { type: Number, default: 1 },
  amenities: [String],
  images: [String],
  description: String,
}, { timestamps: true }));
