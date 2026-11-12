(function () {
'use strict';

/* ---------- langue ---------- */
const T = {
  fr: {
    top: 'Livraison dans les 58 wilayas • Paiement à la livraison',
    eyebrow: 'Collection femme', shop: 'Découvrir la collection', sub: 'Des sacs élégants, livrés chez vous partout en Algérie.',
    collection: 'Nos sacs', none: 'Aucun produit pour le moment. Revenez bientôt !', home: 'Accueil',
    color: 'Couleur', qty: 'Quantité', order: 'Passer la commande', firstName: 'Prénom', lastName: 'Nom',
    phone: 'Téléphone', wilaya: 'Wilaya', choose: '— Choisir la wilaya —', delivType: 'Type de livraison',
    toHome: 'À domicile', toOffice: 'Bureau de livraison', address: 'Adresse complète (commune, rue, n°)',
    pickWilaya: 'Choisissez la wilaya', unavailable: 'Indisponible', free: 'Gratuite',
    product: 'Produit', delivery: 'Livraison', total: 'Total', confirm: 'Confirmer la commande',
    cod: 'Paiement à la livraison. Nous vous appellerons pour confirmer.', soldout: 'Épuisé',
    thanks: 'Merci pour votre commande !', thanksTxt: 'Nous vous appellerons très bientôt pour confirmer la livraison.',
    ref: 'Référence', back: 'Retour à la boutique', da: 'DA', sending: 'Envoi…',
    req: 'Champ obligatoire', badPhone: 'Numéro invalide (ex : 0550123456)', err: 'Une erreur est survenue, réessayez.',
    rate: 'Trop de commandes depuis cet appareil, réessayez plus tard.', nf: 'Produit introuvable', follow: 'Suivez-nous',
    rights: 'Tous droits réservés'
  },
  ar: {
    top: 'التوصيل إلى 58 ولاية • الدفع عند الاستلام',
    eyebrow: 'مجموعة نسائية', shop: 'اكتشفي المجموعة', sub: 'حقائب أنيقة تصلك أينما كنتِ في الجزائر.',
    collection: 'حقائبنا', none: 'لا توجد منتجات حاليا. عودي قريبا!', home: 'الرئيسية',
    color: 'اللون', qty: 'الكمية', order: 'اطلبي الآن', firstName: 'الاسم', lastName: 'اللقب',
    phone: 'رقم الهاتف', wilaya: 'الولاية', choose: '— اختاري الولاية —', delivType: 'نوع التوصيل',
    toHome: 'إلى المنزل', toOffice: 'مكتب التوصيل', address: 'العنوان الكامل (البلدية، الشارع، الرقم)',
    pickWilaya: 'اختاري الولاية', unavailable: 'غير متوفر', free: 'مجاني',
    product: 'المنتج', delivery: 'التوصيل', total: 'المجموع', confirm: 'تأكيد الطلب',
    cod: 'الدفع عند الاستلام. سنتصل بك لتأكيد الطلب.', soldout: 'نفدت الكمية',
    thanks: 'شكرا على طلبك!', thanksTxt: 'سنتصل بك قريبا جدا لتأكيد التوصيل.',
    ref: 'رقم الطلب', back: 'العودة إلى المتجر', da: 'دج', sending: 'جاري الإرسال…',
    req: 'هذا الحقل مطلوب', badPhone: 'رقم غير صحيح (مثال: 0550123456)', err: 'حدث خطأ، حاولي مرة أخرى.',
    rate: 'طلبات كثيرة من هذا الجهاز، حاولي لاحقا.', nf: 'المنتج غير موجود', follow: 'تابعينا',
    rights: 'جميع الحقوق محفوظة'
  }
};
let lang = 'fr';
try { lang = localStorage.getItem('lang') || ((navigator.language || '').startsWith('ar') ? 'ar' : 'fr'); } catch (e) {}
const t = k => T[lang][k] || k;
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('ar', lang === 'ar');
}

/* ---------- utilitaires ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' ' + t('da');
const img = f => '/uploads/' + encodeURIComponent(f);
let toastT;
function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3200); }
async function api(url, opt) {
  const r = await fetch(url, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'err'), { code: j.error, status: r.status });
  return j;
}

let CONFIG = null, PRODUCTS = null;
async function loadConfig() { if (!CONFIG) CONFIG = await api('/api/config'); return CONFIG; }
async function loadProducts() { if (!PRODUCTS) PRODUCTS = await api('/api/products'); return PRODUCTS; }

/* ---------- gabarit commun ---------- */
const WA_ICON = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.200-.4.700-1.300.1-.2 0-.3 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.100-.7.300-.2.300-.9.900-.9 2.200s.9 2.500 1 2.700c.1.200 1.800 2.800 4.400 3.900 1.600.7 2.200.7 3 .6.500-.1 1.500-.6 1.700-1.200.2-.6.2-1.100.2-1.200-.1-.1-.3-.2-.5-.3z"/></svg>';
function waLink(n) { n = String(n || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '213' + n.slice(1); return 'https://wa.me/' + n; }

function layout(inner) {
  const s = CONFIG.shop;
  const soc = [];
  if (s.instagram) soc.push(`<a href="${esc(s.instagram)}" target="_blank" rel="noopener">Instagram</a>`);
  if (s.facebook) soc.push(`<a href="${esc(s.facebook)}" target="_blank" rel="noopener">Facebook</a>`);
  if (s.phone) soc.push(`<a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>`);
  $('#app').innerHTML = `
  <div class="top">${t('top')}</div>
  <header class="hd"><div class="wrap">
    <a class="logo" href="/" data-link><img src="/img/logo.png" alt="echanta"></a>
    <nav><button class="pill" id="lang">${lang === 'fr' ? 'العربية' : 'Français'}</button></nav>
  </div></header>
  ${inner}
  <footer><div class="wrap"><img src="/img/logo.png" alt="echanta">
    <div class="soc">${soc.join('')}</div>
    <div>© ${new Date().getFullYear()} echanta.dz — ${t('rights')}</div></div></footer>
  ${s.whatsapp ? `<a class="wa" href="${esc(waLink(s.whatsapp))}" target="_blank" rel="noopener" aria-label="WhatsApp">${WA_ICON}</a>` : ''}`;
  $('#lang').onclick = () => { lang = lang === 'fr' ? 'ar' : 'fr'; try { localStorage.setItem('lang', lang); } catch (e) {} applyLang(); route(); };
}

/* ---------- accueil ---------- */
async function pageHome() {
  await loadConfig();
  layout('<div class="loader">…</div>');
  let list = [];
  try { list = await loadProducts(); } catch (e) {}
  const s = CONFIG.shop;
  const title = lang === 'ar' ? (s.heroTitleAr || s.heroTitle) : s.heroTitle;
  const cards = list.map(p => {
    const dots = p.images.filter(i => i.hex).map(i => `<span class="dot" title="${esc(i.color)}" style="background:${esc(i.hex)}"></span>`).join('');
    return `<a class="card" href="/produit/${p.id}" data-link>
      <div class="ph">${p.inStock ? '' : `<span class="badge">${t('soldout')}</span>`}
        <img src="${img(p.images[0].file)}" alt="${esc(p.name)}" loading="lazy">
        ${p.images[1] ? `<img src="${img(p.images[1].file)}" alt="" loading="lazy">` : ''}</div>
      <div class="bd"><h3>${esc(p.name)}</h3>
        <div class="price">${money(p.price)}${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ''}</div>
        ${dots ? `<div class="dots">${dots}</div>` : ''}</div></a>`;
  }).join('');
  layout(`
  <section class="hero"><div class="wrap">
    <div class="eyebrow">${t('eyebrow')}</div><h1>${esc(title)}</h1><p>${t('sub')}</p>
    <a class="btn" href="#collection">${t('shop')}</a></div></section>
  <section id="collection" class="wrap"><h2 class="sec-t">${t('collection')}</h2>
    ${cards ? `<div class="grid">${cards}</div>` : `<div class="empty">${t('none')}</div>`}</section>`);
  document.title = 'echanta.dz';
}

/* ---------- page produit + commande ---------- */
async function pageProduct(id) {
  await loadConfig();
  layout('<div class="loader">…</div>');
  let p;
  try { p = await api('/api/products/' + id); } catch (e) {
    layout(`<div class="wrap empty"><p>${t('nf')}</p><br><a class="btn" href="/" data-link>${t('back')}</a></div>`); return;
  }
  document.title = p.name + ' — echanta.dz';
  const W = CONFIG.wilayas;
  const st = { idx: 0, qty: 1, wilaya: '', type: '' };

  layout(`
  <div class="wrap">
   <div class="crumb"><a href="/" data-link>${t('home')}</a> / ${esc(p.name)}</div>
   <div class="pd">
    <div class="gal"><div class="main"><img id="mainImg" alt="${esc(p.name)}"></div><div class="thumbs" id="thumbs"></div></div>
    <div class="info">
      <h1>${esc(p.name)}</h1>
      <div class="price">${money(p.price)}${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ''}</div>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
      <span class="lbl">${t('color')}</span><div class="sw" id="sw"></div><div class="cname" id="cname"></div>

      <form class="box" id="form" novalidate autocomplete="on">
        <h2>${t('order')}</h2>
        <div class="row2">
          <div class="f" data-f="firstName"><label>${t('firstName')}</label><input name="firstName" autocomplete="given-name" maxlength="60"><div class="err">${t('req')}</div></div>
          <div class="f" data-f="lastName"><label>${t('lastName')}</label><input name="lastName" autocomplete="family-name" maxlength="60"><div class="err">${t('req')}</div></div>
        </div>
        <div class="f" data-f="phone"><label>${t('phone')}</label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05 50 12 34 56" maxlength="20" dir="ltr" style="text-align:start"><div class="err">${t('badPhone')}</div></div>
        <div class="f" data-f="wilaya"><label>${t('wilaya')}</label>
          <select name="wilaya"><option value="">${t('choose')}</option>
          ${W.map(w => `<option value="${w.code}">${String(w.code).padStart(2, '0')} - ${esc(lang === 'ar' ? w.ar : w.fr)}</option>`).join('')}</select><div class="err">${t('req')}</div></div>
        <div class="f" data-f="type"><label>${t('delivType')}</label>
          <div class="opts">
            <label class="opt" id="optHome"><input type="radio" name="type" value="home"><b>${t('toHome')}</b><span id="pHome">${t('pickWilaya')}</span></label>
            <label class="opt" id="optOffice"><input type="radio" name="type" value="office"><b>${t('toOffice')}</b><span id="pOffice">${t('pickWilaya')}</span></label>
          </div><div class="err">${t('req')}</div></div>
        <div class="f" data-f="address" id="addrBox" style="display:none"><label>${t('address')}</label><textarea name="address" rows="2" maxlength="250"></textarea><div class="err">${t('req')}</div></div>
        <div class="f"><label>${t('qty')}</label><div class="qty"><button type="button" id="minus">−</button><span id="qv">1</span><button type="button" id="plus">+</button></div></div>
        <div class="hp"><input name="website" tabindex="-1" autocomplete="off"></div>
        <div class="sum" id="sum"></div>
        <br>
        <button class="btn block" type="submit" id="go" ${p.inStock ? '' : 'disabled'}>${p.inStock ? t('confirm') : t('soldout')}</button>
        <div class="note">${t('cod')}</div>
      </form>
    </div>
   </div>
  </div>`);

  const imgs = p.images;
  function showColor() {
    const cur = imgs[st.idx];
    $('#mainImg').src = img(cur.file);
    $('#cname').textContent = cur.color || '';
    document.querySelectorAll('#thumbs button').forEach((b, i) => b.classList.toggle('on', i === st.idx));
    document.querySelectorAll('#sw button').forEach((b, i) => b.classList.toggle('on', i === st.idx));
  }
  $('#thumbs').innerHTML = imgs.map((im, i) => `<button type="button" data-i="${i}" aria-label="${esc(im.color || '')}"><img src="${img(im.file)}" alt=""></button>`).join('');
  $('#sw').innerHTML = imgs.map((im, i) =>
    `<button type="button" data-i="${i}" title="${esc(im.color || '')}" style="${im.hex ? `background:${esc(im.hex)}` : `background-image:url('${img(im.file)}')`}"></button>`).join('');
  if (imgs.length < 2 && !imgs[0].hex && !imgs[0].color) { $('#sw').previousElementSibling.style.display = 'none'; }
  document.querySelectorAll('#thumbs button,#sw button').forEach(b => b.onclick = () => { st.idx = +b.dataset.i; showColor(); });
  showColor();

  const form = $('#form');
  const w = () => W.find(x => String(x.code) === String(st.wilaya));
  function shipPrice(type) { const x = w(); if (!x || !type) return null; return x[type]; }
  function renderOpts() {
    const x = w();
    [['home', 'pHome', 'optHome'], ['office', 'pOffice', 'optOffice']].forEach(([ty, sp, lb]) => {
      const el = $('#' + sp), box = $('#' + lb), inp = box.querySelector('input');
      if (!x) { el.textContent = t('pickWilaya'); box.classList.remove('off'); inp.disabled = false; return; }
      const v = x[ty];
      if (v === null || v === undefined) { el.textContent = t('unavailable'); box.classList.add('off'); inp.disabled = true; if (st.type === ty) { st.type = ''; inp.checked = false; } }
      else { el.textContent = v === 0 ? t('free') : money(v); box.classList.remove('off'); inp.disabled = false; }
      box.classList.toggle('on', st.type === ty);
    });
    $('#addrBox').style.display = st.type === 'home' ? '' : 'none';
  }
  function renderSum() {
    const sp = shipPrice(st.type);
    const sub = p.price * st.qty;
    $('#sum').innerHTML = `
      <div><span>${t('product')} × ${st.qty}</span><span>${money(sub)}</span></div>
      <div><span>${t('delivery')}</span><span>${sp === null ? '—' : sp === 0 ? t('free') : money(sp)}</span></div>
      <div class="tot"><span>${t('total')}</span><span>${money(sub + (sp || 0))}</span></div>`;
    $('#qv').textContent = st.qty;
  }
  $('#minus').onclick = () => { if (st.qty > 1) { st.qty--; renderSum(); } };
  $('#plus').onclick = () => { if (st.qty < 10) { st.qty++; renderSum(); } };
  form.wilaya.onchange = () => { st.wilaya = form.wilaya.value; renderOpts(); renderSum(); };
  form.querySelectorAll('input[name=type]').forEach(r => r.onchange = () => { st.type = r.value; renderOpts(); renderSum(); });
  renderOpts(); renderSum();
  form.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('input', () => { const f = el.closest('.f'); if (f) f.classList.remove('bad'); }));

  form.onsubmit = async e => {
    e.preventDefault();
    const v = n => (form[n] ? form[n].value.trim() : '');
    const phone = v('phone').replace(/[\s.\-]/g, '');
    const bad = {
      firstName: !v('firstName'), lastName: !v('lastName'),
      phone: !/^(0|\+?213)[567]\d{8}$/.test(phone),
      wilaya: !st.wilaya, type: !st.type, address: st.type === 'home' && v('address').length < 4
    };
    let first = null;
    Object.keys(bad).forEach(k => { const f = form.querySelector(`[data-f=${k}]`); if (f) f.classList.toggle('bad', bad[k]); if (bad[k] && !first) first = f; });
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const btn = $('#go'); btn.disabled = true; btn.textContent = t('sending');
    try {
      const r = await api('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: p.id, imageIndex: st.idx, qty: st.qty, firstName: v('firstName'), lastName: v('lastName'),
          phone, wilaya: Number(st.wilaya), deliveryType: st.type, address: v('address'), website: v('website')
        })
      });
      layout(`<div class="done"><div class="ck">✓</div><h1>${t('thanks')}</h1><p>${t('thanksTxt')}</p>
        <div class="ref">${t('ref')} : ${esc(r.ref)}</div><br><a class="btn" href="/" data-link>${t('back')}</a></div>`);
      window.scrollTo(0, 0);
    } catch (er) {
      btn.disabled = false; btn.textContent = t('confirm');
      toast(er.status === 429 ? t('rate') : t('err'));
    }
  };
}

/* ---------- routage ---------- */
function route() {
  applyLang();
  const m = location.pathname.match(/^\/produit\/(\d+)/);
  (m ? pageProduct(m[1]) : pageHome()).catch(() => { $('#app').innerHTML = '<div class="loader">Erreur de chargement. Rechargez la page.</div>'; });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); route(); window.scrollTo(0, 0); }
  const h = e.target.closest('a[href^="#"]');
  if (h) { const el = document.querySelector(h.getAttribute('href')); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }); } }
});
window.addEventListener('popstate', route);
route();
})();
