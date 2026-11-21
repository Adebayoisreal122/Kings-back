import mongoose from 'mongoose';
export default mongoose.model('Coupon', new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 1 },
  minTotal: { type: Number, default: 0 },
  maxUses: { type: Number, default: 0 }, // 0 = unlimited
  used: { type: Number, default: 0 },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // empty = all branches
  validFrom: Date,
  validTo: Date,
  active: { type: Boolean, default: true },
}, { timestamps: true }));
