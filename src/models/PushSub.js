import mongoose from 'mongoose';
export default mongoose.model('PushSub', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
}, { timestamps: true }));
