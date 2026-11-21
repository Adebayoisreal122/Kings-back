import mongoose from 'mongoose';
export default mongoose.model('Notification', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: String,
  message: String,
  link: String,
  read: { type: Boolean, default: false },
}, { timestamps: true }));
