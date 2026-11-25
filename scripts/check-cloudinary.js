// Run with: npm run check:cloudinary
// Tells you exactly why Cloudinary is refusing uploads. Never prints your secret.
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

const { cloud_name, api_key, api_secret } = cloudinary.config();
console.log('Cloud name :', cloud_name || 'MISSING (CLOUDINARY_URL not read)');
console.log('API key    :', api_key ? `${api_key.length} digits (most keys have 15)` : 'MISSING');
console.log('API secret :', api_secret ? `${api_secret.length} characters (most are 27)` : 'MISSING');
if (!cloud_name || !api_key || !api_secret) process.exit(1);

const auth = 'Basic ' + Buffer.from(`${api_key}:${api_secret}`).toString('base64');
const call = async (label, url, opts = {}) => {
  try {
    const r = await fetch(url, { ...opts, headers: { Authorization: auth, ...(opts.headers || {}) } });
    const body = (await r.text()).replace(/\s+/g, ' ').slice(0, 300);
    console.log(`\n${label}\n  HTTP ${r.status}\n  ${body}`);
    return r.status;
  } catch (e) { console.log(`\n${label}\n  Could not reach Cloudinary: ${e.cause?.message || e.message}`); return 0; }
};
await call('1) Account and key check (Admin API)', `https://api.cloudinary.com/v1_1/${cloud_name}/resources/image?max_results=1`);
// A 1x1 PNG, uploaded exactly the way the website uploads photos
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const timestamp = Math.floor(Date.now() / 1000);
const sig = cloudinary.utils.api_sign_request({ timestamp, folder: 'kings-apartment' }, api_secret);
const form = new URLSearchParams({ file: png, api_key, timestamp: String(timestamp), folder: 'kings-apartment', signature: sig });
await call('2) Test upload (a 1-pixel image into the kings-apartment folder)', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, { method: 'POST', headers: { Authorization: '' }, body: form });
