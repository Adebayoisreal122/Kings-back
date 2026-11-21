import mongoose from 'mongoose';
// Seasonal or weekend pricing. Applied night by night on top of the room type's base price.
export default mongoose.model('RateRule', new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', default: null }, // empty = every room type in the branch
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  mode: { type: String, enum: ['percent', 'set'], default: 'percent' }, // percent: +20 or -10; set: fixed nightly price
  value: { type: Number, required: true },
  weekendsOnly: { type: Boolean, default: false }, // Friday and Saturday nights
  active: { type: Boolean, default: true },
}, { timestamps: true }));
