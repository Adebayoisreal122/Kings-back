import mongoose from 'mongoose';
export default mongoose.model('Review', new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  guestName: { type: String, required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 1000 },
  hidden: { type: Boolean, default: false },
}, { timestamps: true }));
