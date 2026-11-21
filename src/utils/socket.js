import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import webpush from 'web-push';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import PushSub from '../models/PushSub.js';
let io, pushReady;
export function initSocket(server) {
  io = new Server(server, { cors: { origin: process.env.CLIENT_URL, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const { id } = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      const user = await User.findById(id);
      if (!user) throw new Error('no user');
      socket.user = user; next();
    } catch { next(new Error('unauthorized')); }
  });
  io.on('connection', (socket) => socket.join(`user:${socket.user._id}`));
}
function setupPush() {
  if (pushReady !== undefined) return pushReady;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT } = process.env;
  pushReady = !!(pub && priv);
  if (pushReady) webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@kingsapartment.com', pub, priv);
  return pushReady;
}
// Save a notification, push it live over the socket, and send a web push for when the app is closed.
export async function notifyUser(userId, { title, message, link }) {
  const n = await Notification.create({ user: userId, title, message, link });
  io?.to(`user:${userId}`).emit('notification', n);
  if (!setupPush()) return;
  const subs = await PushSub.find({ user: userId });
  await Promise.all(subs.map((s) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body: message, url: link || '/' }))
      .catch((e) => ([404, 410].includes(e.statusCode) ? PushSub.deleteOne({ _id: s._id }) : null))));
}
export async function notifyBranch(branchId, payload) {
  const people = await User.find({ $or: [{ role: 'branch_manager', branch: branchId }, { role: 'admin' }], active: true }, '_id');
  await Promise.all(people.map((p) => notifyUser(p._id, payload)));
}
