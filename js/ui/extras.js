import * as DB from '../db/db.js';
import { today, parseNum } from '../logic/workouts.js';
import { measurementSeries, goalProgress } from '../logic/goals.js';
import { exerciseNames, records, compareRanges } from '../logic/stats.js';
import { lineChart } from './chart.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const short = d => new Date(d + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
const back = t => `<header><a class="ico" href="#/progreso" aria-label="Volver">‹</a><h1>${t}</h1></header>`;
const F = [['weight', 'Peso corporal', 'kg'], ['waist', 'Cintura', 'cm'], ['chest', 'Pecho', 'cm'], ['arm', 'Brazo', 'cm']];
let mf = 'weight', gk = 'lift';

export async function medidas() {
  const view = document.querySelector('#view');
  const ms = (await DB.all('measurements')).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const ser = measurementSeries(ms, mf), [, lbl, unit] = F.find(f => f[0] === mf);
  view.innerHTML = `${back('Medidas')}<div id="me"><section class="card"><label class="lbl">Fecha<input id="md" type="date" value="${today()}"></label>
  ${F.map(([k, l, u]) => `<label class="lbl">${l} (${u}) — opcional<input id="m-${k}" inputmode="decimal"></label>`).join('')}
  <button class="btn" data-a="save">Guardar medidas</button></section>
  <section class="card"><div class="chips">${F.map(([k, l]) => `<button class="chip ${mf === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
  <div style="margin-top:12px">${ser.length >= 2 ? lineChart(ser.map(p => ({ x: p.date, y: p.y })), unit) : `<p class="muted">${ser.length} registro(s) de ${lbl.toLowerCase()}. Se necesitan al menos 2 para dibujar la evolución.</p>`}</div></section>
  ${ms.map(m => `<section class="card"><b>${short(m.date)}</b> <button class="x" data-a="del" data-id="${m.id}" style="float:right" aria-label="Eliminar">✕</button>
    <p class="muted">${F.filter(([k]) => m[k] != null).map(([k, l, u]) => `${l} ${m[k]} ${u}`).join(' · ')}</p></section>`).join('')}</div>`;
  view.querySelector('#me').onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.f) { mf = t.dataset.f; return medidas(); }
    if (t.dataset.a === 'del' && confirm('¿Eliminar este registro?')) { await DB.del('measurements', t.dataset.id); return medidas(); }
    if (t.dataset.a !== 'save') return;
    const o = { id: DB.uid(), date: view.querySelector('#md').value || today(), createdAt: Date.now() };
    F.forEach(([k]) => o[k] = parseNum(view.querySelector('#m-' + k).value));
    if (F.every(([k]) => o[k] == null)) return alert('Introduce al menos una medida.');
    await DB.put('measurements', o); medidas();
  };
}

async function shrink(file, max = 1280) { // reduce la foto para no llenar el almacenamiento
  const b = await createImageBitmap(file), k = Math.min(1, max / Math.max(b.width, b.height)), c = document.createElement('canvas');
  c.width = Math.round(b.width * k); c.height = Math.round(b.height * k); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', .85));
}

export async function fotos() {
  const view = document.querySelector('#view');
  const ps = (await DB.all('photos')).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const urls = ps.map(p => URL.createObjectURL(p.blob));
  view.innerHTML = `${back('Fotos')}<div id="ph"><label class="btn">Añadir foto<input id="pf" type="file" accept="image/*" multiple hidden></label>
  <p class="muted">Se guardan solo en tu teléfono y se incluyen en las copias JSON.</p>
  ${ps.length ? `<div class="grid">${ps.map((p, i) => `<button class="th" data-i="${i}"><img src="${urls[i]}" alt="Foto del ${short(p.date)}"><span>${short(p.date)}</span></button>`).join('')}</div>` : '<section class="card"><p class="muted">Aún no hay fotos.</p></section>'}</div>`;
  const root = view.querySelector('#ph');
  root.querySelector('#pf').onchange = async e => {
    try { for (const f of e.target.files) await DB.put('photos', { id: DB.uid(), date: today(), blob: await shrink(f), createdAt: Date.now() }); }
    catch (err) { alert('No se pudo guardar la foto: ' + err.message); }
    urls.forEach(URL.revokeObjectURL); fotos();
  };
  root.onclick = async e => {
    const t = e.target.closest('.th, [data-a]'); if (!t) return;
    if (t.dataset.a === 'close') return root.querySelector('.ov').remove();
    if (t.dataset.a === 'del') { if (confirm('¿Eliminar esta foto?')) { await DB.del('photos', t.dataset.id); urls.forEach(URL.revokeObjectURL); fotos(); } return; }
    const i = t.dataset.i; if (i == null) return;
    root.insertAdjacentHTML('beforeend', `<div class="ov"><img src="${urls[i]}" alt=""><p>${short(ps[i].date)}</p>
      <button class="btn alt" data-a="del" data-id="${ps[i].id}">Eliminar</button><button class="btn" data-a="close">Cerrar</button></div>`);
  };
}

export async function objetivos() {
  const view = document.querySelector('#view');
  const [gs, ws, ms] = await Promise.all([DB.all('goals'), DB.all('workouts'), DB.all('measurements')]);
  const done = ws.filter(w => w.status === 'done'), names = exerciseNames(done);
  const wser = measurementSeries(ms, 'weight'), latest = wser.at(-1)?.y ?? null;
  const ctx = { maxKg: n => records(done, n)?.maxKg.kg, weekCount: compareRanges(done, today()).week.cur.count, latestWeight: latest };
  view.innerHTML = `${back('Objetivos')}<div id="go">
  ${gs.map(g => { const p = goalProgress(g, ctx); return `<section class="card"><b>${p.reached ? '✅ ' : ''}${p.text}</b>
    <div class="bar"><i style="width:${Math.round(p.pct)}%"></i></div><button class="x" data-a="del" data-id="${g.id}" style="float:right" aria-label="Eliminar">✕</button><span class="muted">${Math.round(p.pct)}%</span></section>`; }).join('') || '<section class="card"><p class="muted">Aún no tienes objetivos.</p></section>'}
  <section class="card"><h2>Nuevo objetivo</h2><select id="gk"><option value="lift" ${gk === 'lift' ? 'selected' : ''}>Peso en un ejercicio</option>
  <option value="freq" ${gk === 'freq' ? 'selected' : ''}>Entrenamientos por semana</option><option value="body" ${gk === 'body' ? 'selected' : ''}>Peso corporal</option></select>
  ${gk === 'lift' ? `<select id="ge" style="margin-top:8px">${names.map(n => `<option>${esc(n)}</option>`).join('')}</select>` : ''}
  <label class="lbl" style="margin-top:8px">Objetivo (${gk === 'freq' ? 'entrenamientos' : 'kg'})<input id="gt" inputmode="decimal"></label>
  <button class="btn" data-a="add">Guardar objetivo</button></section></div>`;
  const root = view.querySelector('#go');
  root.onchange = e => { if (e.target.id === 'gk') { gk = e.target.value; objetivos(); } };
  root.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.a === 'del' && confirm('¿Eliminar este objetivo?')) { await DB.del('goals', t.dataset.id); return objetivos(); }
    if (t.dataset.a !== 'add') return;
    const target = parseNum(root.querySelector('#gt').value); if (!target) return alert('Introduce un objetivo válido.');
    const g = { id: DB.uid(), kind: gk, target, createdAt: Date.now() };
    if (gk === 'lift') { if (!names.length) return alert('Registra antes algún entrenamiento con ese ejercicio.'); g.exercise = root.querySelector('#ge').value; }
    if (gk === 'body') { if (latest == null) return alert('Registra primero tu peso corporal en Medidas.'); g.start = latest; }
    await DB.put('goals', g); objetivos();
  };
}
