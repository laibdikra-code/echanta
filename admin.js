(function () {
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' دج';
const img = f => '/uploads/' + encodeURIComponent(f);
let tt;
function toast(m, bad) { const el = $('#toast'); el.textContent = m; el.className = 'show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => el.className = '', 3200); }
async function api(url, opt) {
  opt = opt || {};
  opt.headers = Object.assign({ 'X-Admin': '1' }, opt.headers || {});
  if (opt.json !== undefined) { opt.method = opt.method || 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(opt.json); }
  const r = await fetch('/api/admin' + url, opt);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/login') { showLogin(); throw new Error('auth'); }
  if (!r.ok) throw new Error(j.error || 'خطأ');
  return j;
}
const STATUS = { new: 'جديد', confirmed: 'مؤكد', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغى' };

/* ---------- noms de couleurs (suggestion automatique) ---------- */
const COLORS = [
  ['Noir / أسود', [25, 25, 25]], ['Blanc / أبيض', [245, 245, 245]], ['Gris / رمادي', [140, 140, 140]],
  ['Marron / بني', [101, 67, 33]], ['Chocolat / بني غامق', [60, 36, 21]], ['Beige / بيج', [214, 190, 160]],
  ['Camel / كاميل', [193, 154, 107]], ['Crème / كريمي', [250, 240, 220]], ['Rouge / أحمر', [200, 30, 40]],
  ['Bordeaux / عنابي', [110, 20, 40]], ['Rose / وردي', [240, 150, 180]], ['Fuchsia / فوشي', [210, 30, 120]],
  ['Orange / برتقالي', [240, 130, 30]], ['Jaune / أصفر', [245, 205, 40]], ['Doré / ذهبي', [190, 150, 60]],
  ['Vert / أخضر', [40, 130, 70]], ['Vert olive / زيتي', [110, 110, 50]], ['Bleu / أزرق', [40, 100, 200]],
  ['Bleu marine / كحلي', [20, 30, 80]], ['Turquoise / تركواز', [40, 180, 180]], ['Violet / بنفسجي', [120, 60, 160]],
  ['Lilas / ليلكي', [190, 160, 220]], ['Argent / فضي', [195, 195, 200]]
];
function guessName(hex) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  let best = null, bd = 1e9;
  COLORS.forEach(([name, rgb]) => { const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2; if (d < bd) { bd = d; best = name; } });
  return best;
}
const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/* ---------- traitement d'image côté navigateur ---------- */
function loadImg(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }
async function processFile(file) {
  const url = URL.createObjectURL(file);
  const im = await loadImg(url);
  const max = 1400, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
  URL.revokeObjectURL(url);
  return { blob, url: URL.createObjectURL(blob), hex: dominant(c) };
}
// couleur dominante : on ignore le fond clair/neutre et les zones très sombres de contour
function dominant(canvas) {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, s, s);
  const d = x.getImageData(0, 0, s, s).data, buckets = {};
  for (let py = 0; py < s; py++) for (let px = 0; px < s; px++) {
    const i = (py * s + px) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const centerW = 1 - Math.hypot(px - s / 2, py - s / 2) / (s * .75); // plus de poids au centre
    if (mx > 232 && mx - mn < 22) continue;                              // fond blanc
    const key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
    const e = buckets[key] || (buckets[key] = { w: 0, r: 0, g: 0, b: 0 });
    e.w += centerW; e.r += r * centerW; e.g += g * centerW; e.b += b * centerW;
  }
  let best = null; for (const k in buckets) if (!best || buckets[k].w > best.w) best = buckets[k];
  return best ? toHex(best.r / best.w, best.g / best.w, best.b / best.w) : '#8b5a2b';
}

/* ---------- pipette : choisir la couleur en cliquant sur l'image ---------- */
function pickColor(src) {
  return new Promise(async resolve => {
    const im = await loadImg(src);
    const ov = document.createElement('div'); ov.className = 'picker';
    ov.innerHTML = `<div class="info"><span>انقر على الصورة لالتقاط اللون</span><span class="sw" id="pSw"></span><b id="pHex" dir="ltr">#------</b></div><canvas></canvas><div class="info"><button class="btn sec" id="pCancel">إلغاء</button></div>`;
    document.body.appendChild(ov);
    const c = $('canvas', ov), k = Math.min(1, 1100 / im.naturalWidth, 1100 / im.naturalHeight);
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, c.width, c.height);
    const at = e => {
      const r = c.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
      const px = Math.floor((p.clientX - r.left) * c.width / r.width), py = Math.floor((p.clientY - r.top) * c.height / r.height);
      const R = 3, d = x.getImageData(Math.max(0, px - R), Math.max(0, py - R), R * 2 + 1, R * 2 + 1).data; // moyenne 7x7
      let rr = 0, gg = 0, bb = 0, n = 0; for (let i = 0; i < d.length; i += 4) { rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; }
      return toHex(rr / n, gg / n, bb / n);
    };
    const preview = e => { try { const h = at(e); $('#pSw', ov).style.background = h; $('#pHex', ov).textContent = h; } catch (er) {} };
    c.addEventListener('mousemove', preview);
    const done = v => { ov.remove(); resolve(v); };
    c.addEventListener('click', e => done(at(e)));
    c.addEventListener('touchstart', e => { e.preventDefault(); done(at(e)); }, { passive: false });
    $('#pCancel', ov).onclick = () => done(null);
  });
}

/* ---------- connexion ---------- */
function showLogin() {
  $('#app').innerHTML = `<div class="login"><form id="lf"><img src="/img/logo.png" alt="echanta"><h1>لوحة التحكم</h1>
    <div class="f"><label>اسم المستخدم</label><input name="user" autocomplete="username" required autofocus></div>
    <div class="f"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required></div>
    <button class="btn block" id="lb">دخول</button><div class="err" id="le"></div></form></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const f = e.target; $('#lb').disabled = true; $('#le').textContent = '';
    try { await api('/login', { json: { user: f.user.value, password: f.password.value } }); boot(); }
    catch (er) { $('#le').textContent = er.message === 'rate' ? 'محاولات كثيرة، انتظر بضع دقائق' : 'اسم المستخدم أو كلمة المرور غير صحيحة'; $('#lb').disabled = false; }
  };
}

/* ---------- structure ---------- */
let ME = null, tab = 'orders';
const TABS = [['orders', '📦 الطلبات'], ['products', '👜 المنتجات'], ['delivery', '🚚 أسعار التوصيل'], ['settings', '⚙️ الإعدادات']];
async function boot() {
  try { ME = await api('/me'); } catch (e) { return; }
  $('#app').innerHTML = `<div class="shell"><aside><div class="lg"><img src="/img/logo.png" alt=""></div>
    ${TABS.map(([k, l]) => `<button class="nav" data-t="${k}"><span>${l}</span>${k === 'orders' ? '<span class="cnt" id="cnt" hidden></span>' : ''}</button>`).join('')}
    <div class="sp"></div><a href="/" target="_blank">🌐 عرض المتجر</a><button class="nav" id="out">🚪 خروج</button></aside><main id="main"></main></div>`;
  $$('.nav[data-t]').forEach(b => b.onclick = () => go(b.dataset.t));
  $('#out').onclick = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); showLogin(); };
  go(tab);
}
async function go(t) {
  tab = t; $$('.nav[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const m = $('#main'); m.innerHTML = '<p>…</p>';
  const warn = ME.defaultPassword ? `<div class="warn">⚠️ ما زلت تستعمل كلمة المرور الافتراضية (<b>admin123</b>). غيّرها الآن من تبويب «الإعدادات».</div>` : '';
  m.innerHTML = warn + '<div id="view"></div>';
  try { await ({ orders: viewOrders, products: viewProducts, delivery: viewDelivery, settings: viewSettings })[t]($('#view')); }
  catch (e) { if (e.message !== 'auth') $('#view').innerHTML = '<p>' + esc(e.message) + '</p>'; }
}
function setCount(n) { const c = $('#cnt'); if (!c) return; c.hidden = !n; c.textContent = n; }

/* ---------- commandes ---------- */
async function viewOrders(v) {
  const [orders, stats] = await Promise.all([api('/orders'), api('/stats')]);
  setCount(stats.newOrders);
  v.innerHTML = `<h1 class="pt">الطلبات <button class="btn sec sm" id="csv">⬇ تصدير CSV</button></h1>
  <div class="stats"><div class="stat"><b>${stats.orders}</b><span>كل الطلبات</span></div><div class="stat"><b>${stats.newOrders}</b><span>طلبات جديدة</span></div>
  <div class="stat"><b>${stats.products}</b><span>المنتجات</span></div><div class="stat"><b>${money(stats.revenue)}</b><span>مبيعات تم تسليمها</span></div></div>
  <div class="panel"><div class="bar"><input id="q" placeholder="بحث بالاسم / الهاتف / الرقم / الولاية…">
  <select id="sf"><option value="">كل الحالات</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
  <div class="tw"><table><thead><tr><th>رقم</th><th>التاريخ</th><th>الزبون</th><th>الهاتف</th><th>الولاية</th><th>المنتج</th><th>التوصيل</th><th>المجموع</th><th>الحالة</th></tr></thead><tbody id="tb"></tbody></table></div>
  <p id="none" class="hint" hidden>لا توجد طلبات.</p></div>`;
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase(), sf = $('#sf').value;
    const rows = orders.filter(o => (!sf || o.status === sf) && (!q || [o.ref, o.firstName, o.lastName, o.phone, o.wilayaName, o.productName].join(' ').toLowerCase().includes(q)));
    $('#tb').innerHTML = rows.map(o => `<tr class="click" data-id="${o.id}"><td>${esc(o.ref)}</td><td>${new Date(o.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td>${esc(o.firstName)} ${esc(o.lastName)}</td><td dir="ltr">${esc(o.phone)}</td><td>${esc(o.wilayaName)}</td>
      <td><div style="display:flex;gap:8px;align-items:center"><img class="th" src="${img(o.image)}" alt="" onerror="this.style.visibility='hidden'"><div>${esc(o.productName)} × ${o.qty}<br>${o.hex ? `<span class="dot" style="background:${esc(o.hex)}"></span> ` : ''}<small>${esc(o.color)}</small></div></div></td>
      <td>${o.deliveryType === 'home' ? 'منزل' : 'مكتب'}</td><td><b>${money(o.total)}</b></td><td><span class="st ${o.status}">${STATUS[o.status]}</span></td></tr>`).join('');
    $('#none').hidden = rows.length > 0;
    $$('#tb tr').forEach(tr => tr.onclick = () => orderModal(orders.find(o => o.id == tr.dataset.id), () => go('orders')));
  };
  $('#q').oninput = draw; $('#sf').onchange = draw; draw();
  $('#csv').onclick = () => {
    const head = ['Ref', 'Date', 'Prenom', 'Nom', 'Telephone', 'Wilaya', 'Livraison', 'Adresse', 'Produit', 'Couleur', 'Qte', 'Prix unitaire', 'Frais livraison', 'Total', 'Statut'];
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [head.map(q).join(';')].concat(orders.map(o => [o.ref, o.createdAt, o.firstName, o.lastName, o.phone, o.wilayaName, o.deliveryType === 'home' ? 'Domicile' : 'Bureau', o.address, o.productName, o.color, o.qty, o.unitPrice, o.shipping, o.total, STATUS[o.status]].map(q).join(';')));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'commandes-echanta.csv'; a.click();
  };
}
function modal(html) {
  const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="mbox">${html}</div>`; document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener('mousedown', e => { if (e.target === m) m._down = true; });
  m.addEventListener('click', e => { if (e.target === m && m._down) close(); m._down = false; });
  return { m, close };
}
function orderModal(o, refresh) {
  const { m, close } = modal(`<h2>طلب ${esc(o.ref)} <button id="x">×</button></h2>
   <div style="display:flex;gap:14px;align-items:center;margin-bottom:8px"><img class="th" style="width:72px;height:90px" src="${img(o.image)}" alt="" onerror="this.style.visibility='hidden'">
   <div><b>${esc(o.productName)}</b> × ${o.qty}<br>${o.hex ? `<span class="dot" style="background:${esc(o.hex)}"></span> ` : ''}${esc(o.color)}<br>${money(o.unitPrice)}</div></div>
   <dl class="dl"><dt>الزبون</dt><dd>${esc(o.firstName)} ${esc(o.lastName)}</dd>
   <dt>الهاتف</dt><dd dir="ltr" style="text-align:start"><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a> · <a target="_blank" href="https://wa.me/${esc(o.phone.replace(/^0/, '213').replace(/\D/g, ''))}">WhatsApp</a></dd>
   <dt>الولاية</dt><dd>${esc(o.wilayaName)}</dd><dt>التوصيل</dt><dd>${o.deliveryType === 'home' ? 'إلى المنزل' : 'إلى مكتب التوصيل'} — ${money(o.shipping)}</dd>
   ${o.address ? `<dt>العنوان</dt><dd>${esc(o.address)}</dd>` : ''}<dt>المجموع</dt><dd><b>${money(o.total)}</b></dd>
   <dt>التاريخ</dt><dd>${new Date(o.createdAt).toLocaleString('fr-FR')}</dd></dl>
   <div class="f"><label>الحالة</label><select id="os">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
   <div style="display:flex;gap:10px;justify-content:space-between"><button class="btn red" id="od">حذف الطلب</button><button class="btn" id="os2">حفظ الحالة</button></div>`);
  $('#x', m).onclick = close;
  $('#os2', m).onclick = async () => { try { await api('/orders/' + o.id, { method: 'PATCH', json: { status: $('#os', m).value } }); close(); toast('تم الحفظ'); refresh(); } catch (e) { toast(e.message, 1); } };
  $('#od', m).onclick = async () => { if (!confirm('حذف هذا الطلب نهائيا؟')) return; try { await api('/orders/' + o.id, { method: 'DELETE' }); close(); toast('تم الحذف'); refresh(); } catch (e) { toast(e.message, 1); } };
}

/* ---------- produits ---------- */
async function viewProducts(v) {
  const list = await api('/products');
  v.innerHTML = `<h1 class="pt">المنتجات <button class="btn" id="add">＋ منتج جديد</button></h1>
  ${list.length ? `<div class="pgrid">${list.map(p => `<div class="pc"><div class="im"><img src="${img(p.images[0].file)}" alt=""></div><div class="b"><h3>${esc(p.name)}</h3>
    <div><b>${money(p.price)}</b>${p.oldPrice ? ` <s style="color:var(--muted)">${money(p.oldPrice)}</s>` : ''}</div>
    <div style="margin-top:6px">${p.images.map(i => i.hex ? `<span class="dot" title="${esc(i.color)}" style="background:${esc(i.hex)}"></span>` : '').join(' ')}</div>
    <div class="row">${p.active ? '' : '<span class="tag off">مخفي</span>'}${p.inStock === false ? '<span class="tag off">نفدت الكمية</span>' : '<span class="tag">متوفر</span>'}<span class="tag">${p.images.length} صور</span></div>
    <div class="row"><button class="btn sm" data-e="${p.id}">تعديل</button><button class="btn red sm" data-d="${p.id}">حذف</button></div></div></div>`).join('')}</div>`
    : '<div class="panel">لا توجد منتجات بعد. اضغط «منتج جديد» لإضافة أول حقيبة.</div>'}`;
  $('#add').onclick = () => productModal(null, () => go('products'));
  $$('[data-e]', v).forEach(b => b.onclick = () => productModal(list.find(p => p.id == b.dataset.e), () => go('products')));
  $$('[data-d]', v).forEach(b => b.onclick = async () => {
    if (!confirm('حذف هذا المنتج نهائيا؟')) return;
    try { await api('/products/' + b.dataset.d, { method: 'DELETE' }); toast('تم الحذف'); go('products'); } catch (e) { toast(e.message, 1); }
  });
}

function productModal(p, done) {
  // items : { file?, blob?, url, color, hex, auto }
  let items = p ? p.images.map(i => ({ file: i.file, url: img(i.file), color: i.color, hex: i.hex || '#8b5a2b', auto: false })) : [];
  const { m, close } = modal(`<h2>${p ? 'تعديل المنتج' : 'منتج جديد'} <button id="x">×</button></h2>
  <form id="pf">
   <div class="f"><label>اسم الحقيبة *</label><input dir="auto" name="name" required maxlength="120" value="${esc(p ? p.name : '')}"></div>
   <div class="r2"><div class="f"><label>السعر (دج) *</label><input name="price" type="number" min="0" step="1" required value="${p ? p.price : ''}"></div>
   <div class="f"><label>السعر القديم قبل التخفيض (اختياري)</label><input name="oldPrice" type="number" min="0" step="1" value="${p && p.oldPrice ? p.oldPrice : ''}"></div></div>
   <div class="f"><label>الوصف</label><textarea dir="auto" name="description" rows="3" maxlength="2000">${esc(p ? p.description : '')}</textarea></div>
   <div class="chk"><label><input type="checkbox" name="active" ${!p || p.active ? 'checked' : ''}> ظاهر في المتجر</label><label><input type="checkbox" name="inStock" ${!p || p.inStock !== false ? 'checked' : ''}> متوفر في المخزون</label></div>
   <div class="f"><label>صور المنتج وألوانه *</label>
   <div class="hint">كل صورة = لون من ألوان الحقيبة. الصورة الأولى هي الرئيسية. يُقترح اللون تلقائيا من الصورة، ويمكنك الضغط على الصورة (أو زر «التقاط») لاختيار اللون بنفسك من أي نقطة فيها.</div>
   <div class="imgs" id="imgs"></div>
   <div class="drop" id="drop">＋ اضغط لإضافة صور (يمكن اختيار عدة صور)</div><input type="file" id="fi" accept="image/*" multiple hidden></div>
   <div class="err" id="pe"></div>
   <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px"><button type="button" class="btn sec" id="cx">إلغاء</button><button class="btn" id="sv">حفظ</button></div>
  </form>`);
  const list = $('#imgs', m);
  function draw() {
    list.innerHTML = items.map((it, i) => `<div class="ir" data-i="${i}"><img class="pv" src="${it.url}" title="انقر لالتقاط اللون من الصورة" alt="">
      <div>${i === 0 ? '<span class="mainTag">الرئيسية</span>' : ''}<div class="cf"><input type="text" placeholder="اسم اللون (مثال: Noir / أسود)" value="${esc(it.color)}" data-k="color" maxlength="40">
      <input type="color" value="${esc(it.hex)}" data-k="hex" title="اللون"></div>
      <div class="ac"><button type="button" class="btn sec sm" data-a="pick">🎯 التقاط اللون من الصورة</button><button type="button" class="btn sec sm" data-a="auto">✨ لون تلقائي</button></div></div>
      <div class="mv"><button type="button" class="btn sec sm" data-a="up" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" class="btn sec sm" data-a="down" ${i === items.length - 1 ? 'disabled' : ''}>▼</button><button type="button" class="btn red sm" data-a="del">✕</button></div></div>`).join('');
  }
  list.addEventListener('input', e => {
    const row = e.target.closest('.ir'); if (!row) return; const it = items[row.dataset.i], k = e.target.dataset.k;
    if (k === 'color') { it.color = e.target.value; it.auto = false; }
    if (k === 'hex') { it.hex = e.target.value; if (it.auto || !it.color) { it.color = guessName(it.hex); it.auto = true; row.querySelector('[data-k=color]').value = it.color; } }
  });
  async function setHex(it, hex) { it.hex = hex; if (it.auto || !it.color) { it.color = guessName(hex); it.auto = true; } draw(); }
  list.addEventListener('click', async e => {
    const row = e.target.closest('.ir'); if (!row) return; const i = +row.dataset.i, it = items[i];
    const a = e.target.dataset.a || (e.target.classList.contains('pv') ? 'pick' : '');
    if (a === 'pick') { const h = await pickColor(it.url); if (h) setHex(it, h); }
    else if (a === 'auto') { const im = await loadImg(it.url); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); setHex(it, dominant(c)); }
    else if (a === 'up' && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); }
    else if (a === 'down' && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); }
    else if (a === 'del') { items.splice(i, 1); draw(); }
  });
  $('#drop', m).onclick = () => $('#fi', m).click();
  $('#fi', m).onchange = async e => {
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files) {
      try { const r = await processFile(f); const hex = r.hex; items.push({ blob: r.blob, url: r.url, hex, color: guessName(hex), auto: true }); }
      catch (er) { toast('تعذر قراءة الصورة ' + f.name, 1); }
    }
    draw();
  };
  draw();
  $('#x', m).onclick = $('#cx', m).onclick = close;
  $('#pf', m).onsubmit = async e => {
    e.preventDefault(); const f = e.target; $('#pe', m).textContent = '';
    if (!items.length) { $('#pe', m).textContent = 'أضف صورة واحدة على الأقل'; return; }
    const fd = new FormData();
    fd.append('name', f.name.value); fd.append('price', f.price.value); fd.append('oldPrice', f.oldPrice.value); fd.append('description', f.description.value);
    fd.append('active', f.active.checked ? '1' : '0'); fd.append('inStock', f.inStock.checked ? '1' : '0');
    let n = 0;
    const meta = items.map(it => {
      if (it.blob) { fd.append('newImages', it.blob, 'img' + (n) + '.jpg'); return { upload: n++, color: it.color, hex: it.hex }; }
      return { file: it.file, color: it.color, hex: it.hex };
    });
    fd.append('images', JSON.stringify(meta));
    const sv = $('#sv', m); sv.disabled = true; sv.textContent = 'جاري الحفظ…';
    try { await api(p ? '/products/' + p.id : '/products', { method: p ? 'PUT' : 'POST', body: fd }); close(); toast('تم الحفظ ✓'); done(); }
    catch (er) { $('#pe', m).textContent = er.message; sv.disabled = false; sv.textContent = 'حفظ'; }
  };
}

/* ---------- livraison ---------- */
async function viewDelivery(v) {
  const rows = await api('/delivery');
  v.innerHTML = `<h1 class="pt">أسعار التوصيل <button class="btn" id="sv">💾 حفظ الأسعار</button></h1>
  <div class="panel"><div class="hint">السعر بالدينار. اتركه <b>فارغا</b> = هذا النوع غير متوفر في الولاية، و<b>0</b> = توصيل مجاني.</div>
  <div class="bar"><input id="q" placeholder="بحث عن ولاية…">
   <span>تعميم:</span><input id="ah" type="number" min="0" placeholder="منزل" style="flex:0 0 100px;min-width:90px"><input id="ao" type="number" min="0" placeholder="مكتب" style="flex:0 0 100px;min-width:90px"><button class="btn sec sm" id="ap">تطبيق على الكل</button></div>
  <div class="tw"><table><thead><tr><th>#</th><th>الولاية</th><th>إلى المنزل (دج)</th><th>إلى المكتب (دج)</th></tr></thead><tbody>
  ${rows.map(w => `<tr class="dr" data-c="${w.code}" data-s="${esc((w.fr + ' ' + w.ar + ' ' + w.code).toLowerCase())}"><td>${w.code}</td><td>${esc(w.fr)} — ${esc(w.ar)}</td>
   <td><input type="number" min="0" data-k="home" value="${w.home === null ? '' : w.home}"></td><td><input type="number" min="0" data-k="office" value="${w.office === null ? '' : w.office}"></td></tr>`).join('')}
  </tbody></table></div></div>`;
  $('#q').oninput = e => { const q = e.target.value.trim().toLowerCase(); $$('.dr', v).forEach(r => r.style.display = !q || r.dataset.s.includes(q) ? '' : 'none'); };
  $('#ap').onclick = () => {
    const h = $('#ah').value, o = $('#ao').value;
    if (h === '' && o === '') return toast('أدخل سعرا أولا', 1);
    if (!confirm('تطبيق هذه الأسعار على كل الولايات؟')) return;
    $$('.dr', v).forEach(r => { if (h !== '') r.querySelector('[data-k=home]').value = h; if (o !== '') r.querySelector('[data-k=office]').value = o; });
  };
  $('#sv').onclick = async () => {
    const body = {}; $$('.dr', v).forEach(r => body[r.dataset.c] = { home: r.querySelector('[data-k=home]').value, office: r.querySelector('[data-k=office]').value });
    try { await api('/delivery', { method: 'PUT', json: body }); toast('تم حفظ الأسعار ✓'); } catch (e) { toast(e.message, 1); }
  };
}

/* ---------- réglages ---------- */
async function viewSettings(v) {
  const s = await api('/settings');
  v.innerHTML = `<h1 class="pt">الإعدادات</h1>
  <form class="panel" id="sf"><h3 style="margin-bottom:12px">معلومات المتجر</h3>
   <div class="r2"><div class="f"><label>رقم الهاتف (يظهر في أسفل الموقع)</label><input name="phone" dir="ltr" value="${esc(s.phone)}" placeholder="0550123456"></div>
   <div class="f"><label>رقم واتساب (يظهر زر عائم)</label><input name="whatsapp" dir="ltr" value="${esc(s.whatsapp)}" placeholder="0550123456"></div>
   <div class="f"><label>رابط إنستغرام</label><input name="instagram" dir="ltr" value="${esc(s.instagram)}" placeholder="https://instagram.com/…"></div>
   <div class="f"><label>رابط فيسبوك</label><input name="facebook" dir="ltr" value="${esc(s.facebook)}" placeholder="https://facebook.com/…"></div></div>
   <div class="f"><label>عنوان الصفحة الرئيسية (فرنسي)</label><input name="heroTitle" value="${esc(s.heroTitle)}"></div>
   <div class="f"><label>عنوان الصفحة الرئيسية (عربي)</label><input name="heroTitleAr" value="${esc(s.heroTitleAr)}"></div>
   <button class="btn">حفظ</button></form>
  <form class="panel" id="pw"><h3 style="margin-bottom:12px">تغيير بيانات الدخول</h3>
   <div class="r2"><div class="f"><label>اسم المستخدم</label><input name="user" value="${esc(s.adminUser)}" autocomplete="username"></div><div></div>
   <div class="f"><label>كلمة المرور الحالية</label><input name="current" type="password" autocomplete="current-password" required></div>
   <div class="f"><label>كلمة المرور الجديدة (6 أحرف على الأقل)</label><input name="password" type="password" autocomplete="new-password" required minlength="6"></div></div>
   <button class="btn">تغيير</button></form>`;
  $('#sf').onsubmit = async e => {
    e.preventDefault(); const f = e.target, body = {};
    ['phone', 'whatsapp', 'instagram', 'facebook', 'heroTitle', 'heroTitleAr'].forEach(k => body[k] = f[k].value);
    try { await api('/settings', { method: 'PUT', json: body }); toast('تم الحفظ ✓'); } catch (er) { toast(er.message, 1); }
  };
  $('#pw').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { await api('/password', { json: { current: f.current.value, password: f.password.value, user: f.user.value } }); toast('تم تغيير كلمة المرور ✓'); ME.defaultPassword = false; f.current.value = f.password.value = ''; $('.warn') && $('.warn').remove(); }
    catch (er) { toast(er.message, 1); }
  };
}

boot().catch(() => {});
})();
