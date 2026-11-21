import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'branch_manager', 'admin'], default: 'customer' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // managers only
  active: { type: Boolean, default: true },
}, { timestamps: true });
schema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
  next();
});
schema.methods.matches = function (plain) { return bcrypt.compare(plain, this.password); };
export default mongoose.model('User', schema);
