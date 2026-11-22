// Nigerian-friendly phone normalising: 0803 123 4567, +234 803 123 4567 and 803 123 4567 all become 2348031234567.
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^0\d{10}$/.test(d)) d = '234' + d.slice(1);
  else if (/^[789]\d{9}$/.test(d)) d = '234' + d;
  return /^\d{10,15}$/.test(d) ? d : null;
}
