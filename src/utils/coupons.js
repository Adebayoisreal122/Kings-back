import Coupon from '../models/Coupon.js';
export async function checkCoupon(code, branchId, subtotal) {
  const c = await Coupon.findOne({ code: String(code).trim().toUpperCase(), active: true });
  const now = new Date();
  if (!c || (c.validFrom && now < c.validFrom) || (c.validTo && now > c.validTo)) throw new Error('This coupon is not valid');
  if (c.branch && String(c.branch) !== String(branchId)) throw new Error('This coupon does not apply to this branch');
  if (c.maxUses > 0 && c.used >= c.maxUses) throw new Error('This coupon has been fully used');
  if (subtotal < c.minTotal) throw new Error(`Spend at least ₦${c.minTotal.toLocaleString('en-NG')} to use this coupon`);
  const discount = Math.min(subtotal, c.type === 'percent' ? Math.round((subtotal * c.value) / 100) : c.value);
  return { coupon: c, discount };
}
