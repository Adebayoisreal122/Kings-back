import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';

const LOGO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/logo-mark.png');
const NAVY = '#071B3E', GOLD = '#E8B50A', MUTED = '#5B6B8A', SOFT = '#F5F7FB';
const date = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (n) => 'NGN ' + Number(n || 0).toLocaleString('en-NG'); // built-in PDF fonts have no naira sign
const STATUS = { pending: 'AWAITING CONFIRMATION', confirmed: 'CONFIRMED', checked_in: 'CHECKED IN', checked_out: 'CHECKED OUT' };

// One-page A4 check-in ticket. The QR opens the booking in the manager dashboard so staff can verify it.
export async function buildTicket(b) {
  const qr = await QRCode.toBuffer(`${process.env.CLIENT_URL}/manager/bookings?ref=${b.reference}`, { margin: 1, width: 240, color: { dark: NAVY, light: '#FFFFFF' } });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Booking ticket ${b.reference}`, Author: "The King's Apartment" } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const L = 48, W = 595 - 2 * L;

    // Header
    doc.rect(0, 0, 595, 110).fill(NAVY); doc.rect(0, 110, 595, 5).fill(GOLD);
    doc.image(LOGO, L, 24, { width: 62 });
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(22).text("THE KING'S", 124, 33, { characterSpacing: 3 });
    doc.fillColor(GOLD).fontSize(9).text('APARTMENT', 124, 62, { characterSpacing: 6 });
    doc.fillColor('#FFFFFF').fontSize(11).text('BOOKING TICKET', 300, 46, { width: 247, align: 'right', characterSpacing: 2 });

    // Reference, status, QR
    doc.fillColor(MUTED).fontSize(9).text('BOOKING REFERENCE', L, 142, { characterSpacing: 2 });
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(30).text(b.reference, L, 158);
    const chip = (text, x, color) => { const w = doc.font('Helvetica-Bold').fontSize(9).widthOfString(text) + 22; doc.roundedRect(x, 206, w, 22, 11).fill(color); doc.fillColor('#FFFFFF').text(text, x + 11, 213); return x + w + 8; };
    const paid = b.paymentStatus === 'paid';
    const next = chip(paid ? 'PAID' : 'PAYMENT PENDING', L, paid ? '#0E9F6E' : '#B7791F');
    chip(STATUS[b.status] || b.status.toUpperCase(), next, NAVY);
    doc.image(qr, 595 - L - 124, 136, { width: 124 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('Scan at reception', 595 - L - 124, 262, { width: 124, align: 'center' });
    doc.moveTo(L, 290).lineTo(L + W, 290).lineWidth(0.7).strokeColor('#D5DBE8').stroke();

    // Details
    // Each field draws its label, value and optional note, flowing downward so long text never overlaps.
    const field = (label, value, x, y, note, w = 227) => {
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(label.toUpperCase(), x, y, { width: w, characterSpacing: 1.5 });
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(value, x, y + 14, { width: w });
      if (note) doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(note, x, doc.y + 3, { width: w });
    };
    const R = 320;
    field('Guest', b.guest.name, L, 304, `+${b.guest.phone}`);
    field('Branch', b.branch?.name || '', R, 304, b.branch?.address || '');
    field('Check in', date(b.checkIn), L, 384, `From ${b.branch?.checkInTime || '14:00'}`);
    field('Check out', date(b.checkOut), R, 384, `By ${b.branch?.checkOutTime || '12:00'}`);
    field('Room', b.roomType?.name || '', L, 452, b.room?.number ? `Room ${b.room.number}` : 'Room number is given at check-in');
    field('Stay', `${b.nights} night${b.nights === 1 ? '' : 's'}, ${b.guests} guest${b.guests === 1 ? '' : 's'}`, R, 452);

    // Price summary
    const top = 514, lines = [[`Room, ${b.nights} night${b.nights === 1 ? '' : 's'}`, money(b.subtotal)]];
    if (b.stayDiscount > 0) lines.push([`Long-stay discount (${b.stayDiscountPercent}%)`, `-${money(b.stayDiscount)}`]);
    if (b.discount > 0) lines.push([`Coupon ${b.couponCode}`, `-${money(b.discount)}`]);
    const h = 34 + lines.length * 20 + 30;
    doc.roundedRect(L, top, W, h, 10).fill(SOFT);
    lines.forEach(([k, v], i) => { const y = top + 16 + i * 20; doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(k, L + 18, y).text(v, L + 18, y, { width: W - 36, align: 'right' }); });
    const ty = top + 16 + lines.length * 20 + 6;
    doc.moveTo(L + 18, ty - 4).lineTo(L + W - 18, ty - 4).lineWidth(0.5).strokeColor('#C5CDDD').stroke();
    doc.font('Helvetica-Bold').fontSize(13).text('Total', L + 18, ty + 2).text(money(b.total), L + 18, ty + 2, { width: W - 36, align: 'right' });

    // How to check in
    let y = top + h + 28;
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text('How to check in', L, y); y += 22;
    [['Show this ticket at reception, printed or on your phone.'], ['Bring a valid photo ID.'],
      [`Check-in is from ${b.branch?.checkInTime || '14:00'} and check-out is by ${b.branch?.checkOutTime || '12:00'}.`],
      [paid ? 'Your payment has been received.' : 'Your payment is still pending. Pay online from your tracking link.'],
      ...(b.branch?.phone ? [[`Questions? Call the branch on ${b.branch.phone}.`]] : [])].forEach(([t]) => {
      doc.circle(L + 4, y + 5, 2).fill(GOLD); doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(t, L + 16, y, { width: W - 16 }); y += 20;
    });

    // Footer
    doc.rect(0, 812, 595, 30).fill(NAVY);
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(8).text(`The King's Apartment  |  Keep this ticket safe  |  Issued ${new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' })}`, 0, 823, { width: 595, align: 'center' });
    doc.end();
  });
}
