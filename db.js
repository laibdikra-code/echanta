// Petite base de données JSON (fichier data/db.json) — aucune installation requise.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wilayas = require('./wilayas');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');
fs.mkdirSync(DIR, { recursive: true });

const ZONE_PRICES = { A: [600, 400], B: [800, 500], C: [900, 600], D: [1400, 900] };

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { salt, hash };
}

function defaults() {
  const delivery = {};
  wilayas.forEach(w => { const [h, o] = ZONE_PRICES[w.zone]; delivery[w.code] = { home: h, office: o }; });
  const pw = hashPassword(process.env.ADMIN_PASSWORD || 'admin123');
  return {
    counters: { product: 0, order: 0 },
    settings: {
      shopName: 'echanta',
      phone: '', whatsapp: '', instagram: '', facebook: '',
      heroTitle: 'Des sacs pensés pour sublimer chaque instant',
      heroTitleAr: 'حقائب مصممة لتزيّن كل لحظة',
      adminUser: 'admin', adminSalt: pw.salt, adminHash: pw.hash,
      defaultPassword: !process.env.ADMIN_PASSWORD,
      secret: crypto.randomBytes(32).toString('hex')
    },
    delivery, products: [], orders: []
  };
}

let db;
function load() {
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { db = defaults(); save(); }
  // compléter les champs manquants après une mise à jour
  const d = defaults();
  db.settings = Object.assign({}, d.settings, db.settings);
  db.counters = Object.assign({}, d.counters, db.counters);
  wilayas.forEach(w => { if (!db.delivery[w.code]) db.delivery[w.code] = d.delivery[w.code]; });
}
function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}
load();

module.exports = { get db() { return db; }, save, hashPassword };
