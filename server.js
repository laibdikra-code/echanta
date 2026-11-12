const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const store = require('./lib/db');
const wilayas = require('./lib/wilayas');

const PORT = process.env.PORT || 3000;
const UPLOADS = path.join(__dirname, 'uploads');
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

/* ---------- utilitaires ---------- */
const db = () => store.db;
const clean = (s, max = 200) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const HEX = /^#[0-9a-fA-F]{6}$/;
const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
const sign = v => crypto.createHmac('sha256', db().settings.secret).update(v).digest('hex');
function makeToken() { const exp = String(Date.now() + 7 * 864e5); return exp + '.' + sign(exp); }
function validToken(t) {
  if (!t) return false;
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function requireAdmin(req, res, next) {
  if (!validToken(parseCookies(req).echanta_admin)) return res.status(401).json({ error: 'auth' });
  if (req.method !== 'GET' && req.headers['x-admin'] !== '1') return res.status(403).json({ error: 'csrf' });
  next();
}

// limiteur très simple en mémoire
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr); return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 36e5)) hits.delete(k); }, 6e5).unref();

/* ---------- fichiers statiques ---------- */
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true, index: false }));
app.use(express.static(PUBLIC, { index: false, maxAge: 0 }));

/* ---------- API publique ---------- */
function publicProduct(p) {
  return { id: p.id, name: p.name, description: p.description, price: p.price, oldPrice: p.oldPrice || 0, inStock: p.inStock !== false, images: p.images };
}

app.get('/api/config', (req, res) => {
  const s = db().settings;
  res.json({
    shop: { name: s.shopName, phone: s.phone, whatsapp: s.whatsapp, instagram: s.instagram, facebook: s.facebook, heroTitle: s.heroTitle, heroTitleAr: s.heroTitleAr },
    wilayas: wilayas.map(w => ({ code: w.code, fr: w.fr, ar: w.ar, home: db().delivery[w.code].home, office: db().delivery[w.code].office }))
  });
});

app.get('/api/products', (req, res) => {
  res.json(db().products.filter(p => p.active !== false && p.images.length).map(publicProduct));
});
app.get('/api/products/:id', (req, res) => {
  const p = db().products.find(x => x.id === Number(req.params.id) && x.active !== false);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json(publicProduct(p));
});

app.post('/api/orders', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true, ref: 'EC-000000' }); // piège anti-robots
  if (!limit('order:' + req.ip, 10, 36e5)) return res.status(429).json({ error: 'rate' });

  const product = db().products.find(p => p.id === Number(b.productId) && p.active !== false);
  if (!product) return res.status(400).json({ error: 'product' });
  if (product.inStock === false) return res.status(400).json({ error: 'stock' });
  const img = product.images[Number(b.imageIndex) || 0];
  if (!img) return res.status(400).json({ error: 'color' });
  const qty = Math.round(num(b.qty));
  if (!(qty >= 1 && qty <= 20)) return res.status(400).json({ error: 'qty' });

  const firstName = clean(b.firstName, 60), lastName = clean(b.lastName, 60);
  const phone = clean(b.phone, 20).replace(/[\s.\-]/g, '');
  const w = wilayas.find(x => x.code === Number(b.wilaya));
  const type = b.deliveryType === 'office' ? 'office' : b.deliveryType === 'home' ? 'home' : null;
  const address = clean(b.address, 250);
  if (!firstName || !lastName) return res.status(400).json({ error: 'name' });
  if (!/^(0|\+?213)[567]\d{8}$/.test(phone)) return res.status(400).json({ error: 'phone' });
  if (!w) return res.status(400).json({ error: 'wilaya' });
  if (!type) return res.status(400).json({ error: 'type' });
  if (type === 'home' && address.length < 4) return res.status(400).json({ error: 'address' });
  const shipping = db().delivery[w.code][type];
  if (shipping === null || shipping === undefined) return res.status(400).json({ error: 'unavailable' });

  const d = db();
  d.counters.order += 1;
  const order = {
    id: d.counters.order,
    ref: 'EC-' + String(d.counters.order).padStart(6, '0'),
    productId: product.id, productName: product.name,
    color: img.color || '', hex: img.hex || '', image: img.file,
    qty, unitPrice: product.price,
    firstName, lastName, phone,
    wilayaCode: w.code, wilayaName: w.fr + ' - ' + w.ar,
    deliveryType: type, address,
    shipping, total: product.price * qty + shipping,
    status: 'new', createdAt: new Date().toISOString()
  };
  d.orders.unshift(order);
  store.save();
  res.json({ ok: true, ref: order.ref, total: order.total });
});

/* ---------- API admin ---------- */
const admin = express.Router();

admin.post('/login', (req, res) => {
  if (!limit('login:' + req.ip, 8, 6e5)) return res.status(429).json({ error: 'rate' });
  const s = db().settings;
  const { user, password } = req.body || {};
  const { hash } = store.hashPassword(password || '', s.adminSalt);
  const ok = clean(user) === s.adminUser && hash.length === s.adminHash.length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(s.adminHash));
  if (!ok) return res.status(401).json({ error: 'bad' });
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `echanta_admin=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 86400}${secure}`);
  res.json({ ok: true });
});
admin.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'echanta_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
admin.get('/me', requireAdmin, (req, res) => {
  const s = db().settings;
  res.json({ ok: true, user: s.adminUser, defaultPassword: !!s.defaultPassword });
});

admin.use(requireAdmin);

admin.get('/stats', (req, res) => {
  const o = db().orders;
  res.json({
    orders: o.length, newOrders: o.filter(x => x.status === 'new').length,
    products: db().products.length,
    revenue: o.filter(x => x.status === 'delivered').reduce((a, x) => a + x.total, 0)
  });
});

/* commandes */
admin.get('/orders', (req, res) => res.json(db().orders));
admin.patch('/orders/:id', (req, res) => {
  const o = db().orders.find(x => x.id === Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'status' });
  o.status = req.body.status;
  store.save();
  res.json(o);
});
admin.delete('/orders/:id', (req, res) => {
  const d = db(); const i = d.orders.findIndex(x => x.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  const [o] = d.orders.splice(i, 1);
  store.save(); cleanupFiles([o.image]);
  res.json({ ok: true });
});

/* produits */
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype] || '.jpg';
      cb(null, Date.now().toString(36) + crypto.randomBytes(5).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

function cleanupFiles(files) {
  const used = new Set();
  db().products.forEach(p => p.images.forEach(i => used.add(i.file)));
  db().orders.forEach(o => o.image && used.add(o.image));
  [...new Set(files)].forEach(f => {
    if (f && !used.has(f) && /^[\w.-]+$/.test(f)) fs.unlink(path.join(UPLOADS, f), () => {});
  });
}

admin.get('/products', (req, res) => res.json(db().products));

function buildProduct(req, existing) {
  const b = req.body;
  const name = clean(b.name, 120);
  const price = Math.round(num(b.price));
  const oldPrice = b.oldPrice ? Math.round(num(b.oldPrice)) : 0;
  if (!name) throw new Error('الاسم مطلوب');
  if (!(price >= 0)) throw new Error('السعر غير صحيح');
  let list;
  try { list = JSON.parse(b.images || '[]'); } catch (e) { throw new Error('بيانات الصور غير صحيحة'); }
  const uploaded = req.files || [];
  const owned = new Set((existing ? existing.images : []).map(i => i.file));
  const images = [];
  list.forEach(it => {
    let file = null;
    if (Number.isInteger(it.upload) && uploaded[it.upload]) file = uploaded[it.upload].filename;
    else if (it.file && owned.has(it.file)) file = it.file;
    if (!file) return;
    images.push({ file, color: clean(it.color, 40), hex: HEX.test(it.hex || '') ? it.hex : '' });
  });
  if (!images.length) throw new Error('أضف صورة واحدة على الأقل');
  return {
    name, description: clean(b.description, 2000).replace(/\s*\n\s*/g, '\n'),
    price, oldPrice: oldPrice > price ? oldPrice : 0,
    active: b.active === '1', inStock: b.inStock === '1', images
  };
}

admin.post('/products', upload.array('newImages', 20), (req, res) => {
  try {
    const data = buildProduct(req, null);
    const d = db(); d.counters.product += 1;
    const p = Object.assign({ id: d.counters.product, createdAt: new Date().toISOString() }, data);
    d.products.unshift(p); store.save(); res.json(p);
  } catch (e) { (req.files || []).forEach(f => fs.unlink(f.path, () => {})); res.status(400).json({ error: e.message }); }
});
admin.put('/products/:id', upload.array('newImages', 20), (req, res) => {
  const d = db(); const p = d.products.find(x => x.id === Number(req.params.id));
  if (!p) { (req.files || []).forEach(f => fs.unlink(f.path, () => {})); return res.status(404).json({ error: 'not_found' }); }
  try {
    const old = p.images.map(i => i.file);
    Object.assign(p, buildProduct(req, p));
    store.save(); cleanupFiles(old); res.json(p);
  } catch (e) { (req.files || []).forEach(f => fs.unlink(f.path, () => {})); res.status(400).json({ error: e.message }); }
});
admin.delete('/products/:id', (req, res) => {
  const d = db(); const i = d.products.findIndex(x => x.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  const [p] = d.products.splice(i, 1);
  store.save(); cleanupFiles(p.images.map(x => x.file));
  res.json({ ok: true });
});

/* livraison */
admin.get('/delivery', (req, res) => {
  res.json(wilayas.map(w => ({ code: w.code, fr: w.fr, ar: w.ar, home: db().delivery[w.code].home, office: db().delivery[w.code].office })));
});
admin.put('/delivery', (req, res) => {
  const body = req.body || {};
  const val = v => (v === null || v === '' || v === undefined) ? null : (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : undefined);
  for (const w of wilayas) {
    const r = body[w.code]; if (!r) continue;
    const h = val(r.home), o = val(r.office);
    if (h === undefined || o === undefined) return res.status(400).json({ error: 'سعر غير صحيح - ' + w.fr });
    db().delivery[w.code] = { home: h, office: o };
  }
  store.save(); res.json({ ok: true });
});

/* réglages */
admin.get('/settings', (req, res) => {
  const s = db().settings;
  res.json({ shopName: s.shopName, phone: s.phone, whatsapp: s.whatsapp, instagram: s.instagram, facebook: s.facebook, heroTitle: s.heroTitle, heroTitleAr: s.heroTitleAr, adminUser: s.adminUser });
});
admin.put('/settings', (req, res) => {
  const b = req.body || {}, s = db().settings;
  ['shopName', 'phone', 'whatsapp', 'instagram', 'facebook', 'heroTitle', 'heroTitleAr'].forEach(k => { if (k in b) s[k] = clean(b[k], 200); });
  store.save(); res.json({ ok: true });
});
admin.post('/password', (req, res) => {
  const { current, password, user } = req.body || {};
  const s = db().settings;
  const { hash } = store.hashPassword(current || '', s.adminSalt);
  if (hash !== s.adminHash) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)' });
  const h = store.hashPassword(password);
  s.adminSalt = h.salt; s.adminHash = h.hash; s.defaultPassword = false;
  if (clean(user)) s.adminUser = clean(user, 40);
  store.save(); res.json({ ok: true });
});

app.use('/api/admin', admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

/* ---------- pages ---------- */
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(PUBLIC, 'admin', 'index.html')));
app.get(['/', '/produit/:id'], (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.use((req, res) => res.redirect('/'));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'الصورة كبيرة جدا أو عدد الصور زائد' });
  console.error(err);
  res.status(500).json({ error: 'server' });
});

app.listen(PORT, () => {
  console.log('\n  echanta.dz  ->  http://localhost:' + PORT);
  console.log('  Admin       ->  http://localhost:' + PORT + '/admin');
  if (db().settings.defaultPassword) console.log('  Admin par défaut: admin / admin123  (changez-le dans Paramètres)\n');
});
