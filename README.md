# The King's Apartment: hotel booking platform

Two apps: `server/` (Express + MongoDB + Socket.IO) and `web/` (Next.js 14 + Tailwind, installable PWA).

## Run it
```bash
# API
cd server && cp .env.example .env   # set MONGO_URI, JWT_SECRET, PAYSTACK_SECRET_KEY
npm install && npm run seed && npm run dev

# Web (new terminal)
cd web && cp .env.example .env.local
npm install && npm run dev          # http://localhost:3000
```
Seed logins (change before going live):
- Admin: admin@kingsapartment.com / Admin12345
- Manager: ibadan@kingsapartment.com / Manager12345
- Customers register themselves at /register.

## Flow
Customer books > branch manager and admins get a live notification > manager confirms > guest pays (Paystack) > manager checks in with a room > check out. The customer sees every step on the tracker.

## Setup for the new features
Add these to `server/.env` (see `.env.example`):
- **Web push:** run `npm run vapid` in `server/` and paste the two keys. Managers, admins and guests tap "Turn on alerts" in the header. On iPhone, the app must be added to the Home Screen first.
- **Image uploads:** set `CLOUDINARY_URL`. Admins upload branch and room photos from Branches and Rooms & rates (JPG, PNG or WebP, up to 5 MB).
- **Paystack webhook:** in the Paystack dashboard set the webhook URL to `https://YOUR-API/api/payments/webhook`. Payments are confirmed by signature, so a guest who closes the tab after paying is still marked paid.

## What's included
- **Admin:** Overview, Branches (details and photos), Rooms & rates (room types, rooms by number range, seasonal and weekend rate rules), Coupons, Reviews (hide or show), Reports (bookings CSV by date and branch).
- **Manager:** live alerts, booking actions, CSV export for their branch.
- **Guest:** live price with rate rules, coupon codes, reviews after check-out, branch ratings. The seed adds a `WELCOME10` coupon.

## Next up
Cancellation and refund policy, Paystack refunds, PDF reports, email receipts, and multi-language support.
