import 'dotenv/config';
import 'express-async-errors';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import { initSocket } from './utils/socket.js';
import auth from './routes/auth.js';
import branches from './routes/branches.js';
import bookings from './routes/bookings.js';
import manager from './routes/manager.js';
import admin from './routes/admin.js';
import adminExtra from './routes/adminExtra.js';
import notifications from './routes/notifications.js';
import payments from './routes/payments.js';
import webhook from './routes/webhook.js';
import push from './routes/push.js';
import uploads from './routes/uploads.js';
import coupons from './routes/coupons.js';
import reviews from './routes/reviews.js';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }), cors({ origin: process.env.CLIENT_URL }), morgan('dev'));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), webhook); // raw body, before express.json
app.use(express.json());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }), auth);
app.use('/api/branches', branches);
app.use('/api/bookings', bookings);
app.use('/api/manager', manager);
app.use('/api/admin', admin);
app.use('/api/admin', adminExtra);
app.use('/api/notifications', notifications);
app.use('/api/payments', payments);
app.use('/api/push', push);
app.use('/api/uploads', uploads);
app.use('/api/coupons', coupons);
app.use('/api/reviews', reviews);
app.use((err, _req, res, _next) => {
  if (['ValidationError', 'CastError'].includes(err.name)) return res.status(400).json({ message: 'Check the details and try again' });
  console.error(err); res.status(500).json({ message: 'Something went wrong' });
});

const server = http.createServer(app);
initSocket(server);
await connectDB();
server.listen(process.env.PORT || 5000, () => console.log('API on :' + (process.env.PORT || 5000)));
