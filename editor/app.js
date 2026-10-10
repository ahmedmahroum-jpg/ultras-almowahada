(async function () {
  'use strict';
  const DATA = window.EDITOR_DATA, Core = window.TemplateCore, KEY = 'ultras-editor-v1';
  const $ = id => document.getElementById(id);
  const templates = new Map(DATA.templates.map(t => [t.id, t]));
  const fieldsOf = t => [...(t.fields || []), ...(t.advanced || [])];
  const textFields = t => fieldsOf(t).filter(f => f.kind !== 'image');
  const imageFields = t => fieldsOf(t).filter(f => f.kind === 'image');
  const baseCrop = () => ({zoom: 1, offsetX: 0, offsetY: 0});
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const record = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const state = {version: 1, selectedId: null, drafts: {}};
  let svg = null, renderToken = 0, saveTimer, toastTimer, busy = false, uploads = 0, overflow = false;
  const uploadTokens = new Map();
  const current = () => templates.get(state.selectedId);
  function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('toast').hidden = true;}, 5000);
  }
  function freshDraft(t) {
    return {values: Object.fromEntries(textFields(t).map(f => [f.id, String(f.default ?? '')])), images: {}, crop: {}};
  }
  function draft(t = current()) {return state.drafts[t.id] || (state.drafts[t.id] = freshDraft(t));}
  function validateDraft(t, input) {
    if (!record(input) || !record(input.values) || (input.images != null && !record(input.images)) || (input.crop != null && !record(input.crop))) throw Error('بنية ملف التحرير غير صالحة.');
    const out = freshDraft(t);
    for (const f of textFields(t)) {
      if (!Object.hasOwn(input.values, f.id)) continue;
      const value = input.values[f.id];
      if (typeof value !== 'string' || value.length > 20000) throw Error('أحد النصوص غير صالح أو يتجاوز ٢٠ ألف حرف.');
      out.values[f.id] = value;
    }
    for (const f of imageFields(t)) {
      const value = input.images?.[f.id];
      if (value != null) {
        if (typeof value !== 'string' || value.length > 10 * 1024 * 1024 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('الصورة المضمّنة غير صالحة.');
        out.images[f.id] = value;
      }
      const crop = input.crop?.[f.id];
      if (crop != null && !record(crop)) throw Error('إعدادات قص الصورة غير صالحة.');
      out.crop[f.id] = baseCrop();
      for (const [key, low, high] of [['zoom', .2, 3], ['offsetX', -1, 1], ['offsetY', -1, 1]]) {
        if (crop?.[key] == null) continue;
        if (typeof crop[key] !== 'number' || !Number.isFinite(crop[key])) throw Error('إعدادات قص الصورة غير صالحة.');
        out.crop[f.id][key] = clamp(crop[key], low, high);
      }
      for (const key of ['sourceWidth', 'sourceHeight']) {
        if (crop?.[key] == null) continue;
        if (typeof crop[key] !== 'number' || !Number.isFinite(crop[key]) || crop[key] <= 0 || crop[key] > 20000) throw Error('أبعاد الصورة غير صالحة.');
        out.crop[f.id][key] = crop[key];
      }
    }
    return out;
  }
  function persist() {
    clearTimeout(saveTimer);
    try {localStorage.setItem(KEY, JSON.stringify(state)); $('saveStatus').textContent = 'تم الحفظ على هذا الجهاز';}
    catch (_) {$('saveStatus').textContent = 'تعذّر الحفظ التلقائي — احفظ ملف التحرير'; toast('تعذّر الحفظ في المتصفح. استخدم «حفظ ملف التحرير» للاحتفاظ بعملك.');}
  }
  function scheduleSave() {
    $('saveStatus').textContent = 'جارٍ الحفظ…'; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 400);
  }
  function restore() {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return;
      const saved = JSON.parse(raw);
      if (!record(saved) || saved.version !== 1 || !record(saved.drafts)) throw Error();
      for (const [id, value] of Object.entries(saved.drafts)) if (templates.has(id)) state.drafts[id] = validateDraft(templates.get(id), value);
      if (templates.has(saved.selectedId)) state.selectedId = saved.selectedId;
      $('saveStatus').textContent = 'استُعيدت المسودات المحفوظة';
    } catch (_) {toast('تعذّر استعادة بعض المسودات. يمكنك فتح ملف تحرير محفوظ.');}
  }
  function controls() {
    const disabled = busy || uploads > 0 || overflow || !svg;
    $('exportPng').disabled = disabled; $('exportSvg').disabled = disabled;
    $('saveFile').disabled = busy || uploads > 0;
    $('exportPng').textContent = busy ? 'جارٍ تجهيز الصورة…' : 'تنزيل الصورة PNG ↓';
  }
  function fitPreview() {
    const t = current(); if (!t) return;
    const box = $('canvasViewport'), availableWidth = Math.max(1, box.clientWidth - 32), availableHeight = Math.max(1, box.clientHeight - 32);
    const ratio = Math.min(availableWidth / t.width, availableHeight / t.height);
    $('preview').style.width = `${Math.max(1, Math.floor(t.width * ratio))}px`;
    $('preview').style.height = `${Math.max(1, Math.floor(t.height * ratio))}px`;
  }
  const fontsReady = document.fonts ? document.fonts.load('900 48px Cairo').then(() => document.fonts.ready) : Promise.resolve();
  async function render() {
    const token = ++renderToken; await fontsReady; if (token !== renderToken) return;
    const t = current(); if (!t) return;
    try {
      const d = draft(t), next = Core.parseSVG(t.svg.replace('__FONT_FACE__', DATA.fontCss));
      const problems = [];
      for (const f of textFields(t)) {
        const value = d.values[f.id] ?? f.default;
        if (value !== f.default && Core.editTextBlock(next, f, value).overflow) problems.push(f.label);
      }
      for (const f of imageFields(t)) {
        const crop = {sourceWidth: f.sourceWidth, sourceHeight: f.sourceHeight, ...baseCrop(), ...d.crop[f.id]};
        if (d.images[f.id] || crop.zoom !== 1 || crop.offsetX !== 0 || crop.offsetY !== 0) {
          const image = next.getElementById(f.targets[0]);
          const source = d.images[f.id] || image.getAttribute('href') || image.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
          Core.updateImage(next, f.targets[0], source, crop);
        }
      }
      svg = next; $('preview').replaceChildren(svg); $('preview').style.background = t.id === 'logo-white' ? '#073E2A' : '';
      $('canvasMeta').textContent = `${t.width} × ${t.height} px`; overflow = problems.length > 0;
      $('overflowWarning').hidden = !overflow;
      $('overflowWarning').textContent = overflow ? `النص أطول من المساحة المتاحة: ${problems.join('، ')}. اختصره قبل التنزيل؛ لم نحذف أي نص.` : '';
      fitPreview(); controls();
    } catch (error) {svg = null; controls(); toast(`تعذّر تحديث المعاينة: ${error.message}`);}
  }
  function node(tag, cls, text) {
    const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el;
  }
  function gallery() {
    $('gallery').replaceChildren(); $('templateCount').textContent = String(DATA.templates.length);
    for (const t of DATA.templates) {
      const button = node('button', 'template-option'); button.type = 'button'; button.dataset.templateId = t.id;
      button.setAttribute('aria-current', String(t.id === state.selectedId));
      const img = node('img'); img.src = t.thumbnail; img.alt = ''; img.loading = 'lazy';
      const info = node('span'); info.append(node('strong', '', t.title), node('small', '', `${t.width} × ${t.height}`));
      button.append(img, info); button.addEventListener('click', () => selectTemplate(t.id)); $('gallery').append(button);
    }
  }
  function textControl(t, f, destination) {
    const d = draft(t), wrapper = node('div', 'field'), label = node('label', 'field-label', f.label);
    label.htmlFor = `field-${f.id}`;
    const input = node(f.kind === 'textarea' ? 'textarea' : 'input'); input.id = label.htmlFor; input.name = f.id;
    if (f.kind === 'textarea') input.rows = (f.maxLines || 3) > 3 ? 6 : 3; else input.type = 'text';
    input.dir = f.direction || 'rtl'; input.value = d.values[f.id] ?? f.default;
    const helpText = () => `${input.value.length.toLocaleString('ar')} حرف${f.kind === 'textarea' ? ' · يضبط حجم الخط تلقائياً مع ثبات الموضع' : ''}`;
    const help = node('div', 'field-help', helpText());
    input.addEventListener('input', () => {d.values[f.id] = input.value; help.textContent = helpText(); render(); scheduleSave();});
    wrapper.append(label, input, help); destination.append(wrapper);
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {const img = new Image(); img.onload = () => img.naturalWidth && img.naturalHeight ? resolve(img) : reject(Error('الصورة غير صالحة.')); img.onerror = () => reject(Error('تعذّر قراءة الصورة.')); img.src = url;});
  }
  async function normalizeImage(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('اختر صورة PNG أو JPG أو WebP.');
    if (file.size > 15 * 1024 * 1024) throw Error('حجم الصورة يجب ألا يتجاوز ١٥ ميغابايت.');
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      let ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight)), result;
      do {
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height); result = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', .9); ratio *= .8;
      } while (result.length > 4 * 1024 * 1024 && canvas.width > 1 && canvas.height > 1);
      if (result.length > 4 * 1024 * 1024) throw Error('تعذّر تقليل حجم الصورة. جرّب صورة أصغر.');
      return {dataUrl: result, sourceWidth: canvas.width, sourceHeight: canvas.height};
    } finally {URL.revokeObjectURL(url);}
  }
  function imageControl(t, f, destination) {
    const d = draft(t), wrapper = node('div', 'field'), label = node('label', 'field-label', f.label);
    const upload = node('input'); upload.type = 'file'; upload.accept = 'image/png,image/jpeg,image/webp'; upload.id = `field-${f.id}`; label.htmlFor = upload.id;
    const box = node('div', 'upload-box'), thumb = node('img'); thumb.alt = 'الصورة الحالية';
    const original = Core.parseSVG(t.svg.replace('__FONT_FACE__', DATA.fontCss)).getElementById(f.targets[0]);
    thumb.src = d.images[f.id] || original?.getAttribute('href') || original?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
    upload.hidden = true;
    const picker = node('button', 'button secondary', 'اختيار صورة'); picker.type = 'button'; picker.addEventListener('click', () => upload.click());
    const uploadInfo = node('div'); uploadInfo.append(picker, node('p', '', 'PNG · JPG · WebP — حتى ١٥ ميغابايت'));
    box.append(thumb, uploadInfo);
    const actions = node('div', 'upload-actions'), reset = node('button', 'button quiet', 'استعادة الصورة الأصلية'); reset.type = 'button'; actions.append(reset);
    const cropBox = node('div', 'crop-controls'); d.crop[f.id] ||= baseCrop();
    for (const [key, title, min, max] of [['zoom', 'تصغير وتكبير الصورة', .2, 3], ['offsetX', 'الإزاحة الأفقية', -1, 1], ['offsetY', 'الإزاحة العمودية', -1, 1]]) {
      const label = node('label', '', title), range = node('input'); range.type = 'range'; range.name = `crop-${key}`; range.id = `crop-${f.id}-${key}`; label.htmlFor = range.id;
      range.min = min; range.max = max; range.step = key === 'zoom' ? .01 : .05; range.value = d.crop[f.id][key];
      const percentage = key === 'zoom' ? node('output', 'crop-zoom-value', `${Math.round(d.crop[f.id][key] * 100)}%`) : null;
      if (percentage) {percentage.htmlFor = range.id; percentage.setAttribute('aria-live', 'polite'); label.append(percentage);}
      range.addEventListener('input', () => {
        d.crop[f.id][key] = Number(range.value); if (percentage) percentage.textContent = `${Math.round(d.crop[f.id][key] * 100)}%`;
        render(); scheduleSave();
      }); label.append(range); cropBox.append(label);
    }
    const cropActions = node('div', 'crop-actions');
    const applyCrop = zoom => {if (zoom != null) d.crop[f.id].zoom = zoom; d.crop[f.id].offsetX = 0; d.crop[f.id].offsetY = 0; form(); render(); scheduleSave();};
    for (const [title, action] of [
      ['احتواء الصورة كاملة', () => {
        const sw = d.crop[f.id].sourceWidth || f.sourceWidth, sh = d.crop[f.id].sourceHeight || f.sourceHeight;
        if (![sw, sh, f.width, f.height].every(n => Number.isFinite(n) && n > 0)) {toast('تعذّر تحديد أبعاد الصورة. أعد اختيارها ثم حاول مجدداً.'); return;}
        const scaleX = f.width / sw, scaleY = f.height / sh;
        applyCrop(clamp(Math.min(scaleX, scaleY) / Math.max(scaleX, scaleY), .2, 3));
      }],
      ['توسيط الصورة', () => applyCrop(null)],
      ['ملء الإطار', () => applyCrop(1)]
    ]) {const button = node('button', 'button quiet', title); button.type = 'button'; button.addEventListener('click', action); cropActions.append(button);}
    cropBox.append(cropActions);
    const tokenKey = `${t.id}:${f.id}`;
    const resetCredit = value => {const credit = textFields(t).find(item => item.id === 'credit'); if (credit) d.values.credit = value === null ? credit.default : value;};
    reset.addEventListener('click', () => {uploadTokens.set(tokenKey, (uploadTokens.get(tokenKey) || 0) + 1); delete d.images[f.id]; d.crop[f.id] = baseCrop(); resetCredit(null); if (current()?.id === t.id) {form(); render();} scheduleSave();});
    upload.addEventListener('change', async () => {
      const file = upload.files?.[0]; if (!file) return;
      const token = (uploadTokens.get(tokenKey) || 0) + 1; uploadTokens.set(tokenKey, token); uploads++; controls(); toast('جارٍ تجهيز الصورة…');
      try {
        const data = await normalizeImage(file); if (uploadTokens.get(tokenKey) !== token || state.drafts[t.id] !== d) return;
        d.images[f.id] = data.dataUrl; d.crop[f.id] = {...baseCrop(), sourceWidth: data.sourceWidth, sourceHeight: data.sourceHeight}; resetCredit('');
        if (current()?.id === t.id) {form(); await render();} scheduleSave(); toast('أضيفت الصورة. أضف مصدرها أو اسم المصوّر عند الحاجة.');
      } catch (error) {toast(error.message);} finally {uploads--; controls(); upload.value = '';}
    });
    wrapper.append(label, box, upload, actions, cropBox); destination.append(wrapper);
  }
  function form() {
    const t = current(); $('fields').replaceChildren(); $('extraFields').replaceChildren();
    $('selectedTitle').textContent = t.title; $('selectedDescription').textContent = t.description;
    if (t.visualOnly) $('fields').append(node('div', 'visual-only', 'هذا العنصر رسومي. يمكنك تنزيله كصورة أو كملف SVG للتعديل مع المصمم.'));
    for (const [items, destination] of [[t.fields || [], $('fields')], [t.advanced || [], $('extraFields')]]) {
      for (const f of items) (f.kind === 'image' ? imageControl : textControl)(t, f, destination);
    }
    $('advancedSection').hidden = !(t.advanced || []).length;
  }
  async function selectTemplate(id) {
    if (!templates.has(id)) throw Error('القالب غير موجود.');
    state.selectedId = id; draft(); svg = null; overflow = false; controls(); gallery(); form(); await render(); scheduleSave();
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = node('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function filename(ext) {return `${state.selectedId}-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;}
  $('editorForm').addEventListener('submit', event => event.preventDefault());
  $('exportPng').addEventListener('click', async () => {
    if (busy || uploads || overflow || !svg) return; busy = true; controls();
    const t = current(), source = svg.cloneNode(true), name = filename('png');
    try {const blob = await Core.exportPNG(source, t.width, t.height, Number($('exportScale').value)); download(blob, name); toast('الصورة جاهزة للتنزيل.');}
    catch (error) {toast(`تعذّر تصدير الصورة: ${error.message}`);} finally {busy = false; controls();}
  });
  $('exportSvg').addEventListener('click', () => {if (busy || uploads || overflow || !svg) return; download(new Blob([Core.exportSVG(svg)], {type: 'image/svg+xml;charset=utf-8'}), filename('svg'));});
  $('saveFile').addEventListener('click', () => {
    const d = draft();
    download(new Blob([JSON.stringify({format: 'ultras-design', version: 1, templateId: state.selectedId, values: d.values, images: d.images, crop: d.crop}, null, 2)], {type: 'application/json;charset=utf-8'}), filename('json'));
    persist();
  });
  $('loadFile').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024) throw Error('ملف التحرير كبير جداً؛ الحد ١٢ ميغابايت.');
      const input = JSON.parse(await file.text());
      if (!record(input) || input.format !== 'ultras-design' || input.version !== 1 || !templates.has(input.templateId)) throw Error('هذا الملف ليس ملف تحرير متوافقاً.');
      const t = templates.get(input.templateId), next = validateDraft(t, input);
      await Promise.all(Object.entries(next.images).map(async ([id, url]) => {
        const image = await loadImage(url); if (image.naturalWidth > 20000 || image.naturalHeight > 20000) throw Error('أبعاد الصورة المضمّنة كبيرة جداً.');
        next.crop[id] = {...next.crop[id], sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight};
      }));
      state.drafts[t.id] = next; await selectTemplate(t.id); persist(); toast('فُتح ملف التحرير بنجاح.');
    } catch (error) {toast(`تعذّر فتح الملف: ${error.message}`);} finally {event.target.value = '';}
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('استعادة القالب الأصلي؟ سيُستبدل محتوى هذا التصميم فقط.')) return;
    state.drafts[state.selectedId] = freshDraft(current()); form(); render(); scheduleSave();
  });
  window.addEventListener('beforeunload', persist); new ResizeObserver(fitPreview).observe($('canvasViewport'));
  window.EditorApp = Object.freeze({selectTemplate, render, getState: () => state});
  restore(); await selectTemplate(state.selectedId || (templates.has('02-quote') ? '02-quote' : DATA.templates[0].id));
})().catch(error => {
  console.error(error); const target = document.getElementById('toast'); if (target) {target.hidden = false; target.textContent = `تعذّر تشغيل المحرر: ${error.message}`;}
});
