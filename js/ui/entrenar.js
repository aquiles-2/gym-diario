import * as DB from '../db/db.js';
import { norm, today, parseNum, volume, lastSession, setText } from '../logic/workouts.js';
import { startTimer } from './timer.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const fmt = d => new Date(d + 'T00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const TIPOS = ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Brazos'];
let flush = () => {};
document.addEventListener('visibilitychange', () => document.hidden && flush());
addEventListener('pagehide', () => flush());

export async function entrenar(id) {
  const view = document.querySelector('#view');
  const w = id ? await DB.get('workouts', id) : (await DB.all('workouts')).find(x => x.status === 'draft');
  return w ? editor(view, w) : inicio(view);
}

function inicio(view) {
  view.innerHTML = `<header><h1>Entrenar</h1></header><div id="ed"><section class="card">
  <label class="lbl">Fecha<input id="fecha" type="date" value="${today()}"></label>
  <label class="lbl">Nombre del entrenamiento<input id="nom" placeholder="Pecho, espalda, pierna…" autocomplete="off"></label>
  <div class="chips">${TIPOS.map(t => `<button class="chip" data-n="${t}">${t}</button>`).join('')}</div>
  <button class="btn" id="go">Empezar</button></section>
  <a class="btn alt" href="#/rutinas">Mis rutinas</a></div>`;
  const ed = view.querySelector('#ed');
  ed.onclick = async e => {
    if (e.target.dataset.n) return (ed.querySelector('#nom').value = e.target.dataset.n);
    if (e.target.id !== 'go') return;
    const now = Date.now();
    const w = { id: DB.uid(), date: ed.querySelector('#fecha').value || today(), name: ed.querySelector('#nom').value.trim() || 'Entrenamiento',
      status: 'draft', notes: '', exercises: [], createdAt: now, updatedAt: now };
    await DB.put('workouts', w);
    editor(view, w);
  };
}

async function ensureExercise(name) {
  const n = norm(name), ex = (await DB.all('exercises')).find(x => norm(x.name) === n);
  if (ex) return ex.id;
  const o = { id: DB.uid(), name: name.trim(), favorite: false, createdAt: Date.now() };
  await DB.put('exercises', o); return o.id;
}

async function editor(view, w) {
  const history = await DB.all('workouts'), catalog = await DB.all('exercises');
  const save = () => { w.updatedAt = Date.now(); return DB.put('workouts', w); };
  let timer; const soon = () => { clearTimeout(timer); timer = setTimeout(save, 250); };
  flush = () => { clearTimeout(timer); save(); };
  const draft = w.status === 'draft';

  const render = (focus) => {
    view.innerHTML = `<header><h1>${esc(w.name)}</h1></header><div id="ed">
    <p class="muted">${fmt(w.date)} · Volumen: <b id="vol">${Math.round(volume(w))}</b> kg ${draft ? '· borrador guardado' : ''}</p>
    <div class="chips">${[60, 90, 120, 180].map(s => `<button class="chip" data-a="tm" data-s="${s}">⏱ ${s} s</button>`).join('')}</div>
    ${w.exercises.map((e, i) => {
      const last = lastSession(history, e.name, w.date, w.id);
      return `<section class="card ex"><div class="exh"><button class="lnk" data-a="ren" data-e="${i}">${esc(e.name)}</button>
      <button class="x star" data-a="fav" data-e="${i}" aria-label="Favorito">${catalog.find(c => c.id === e.exerciseId)?.favorite ? '★' : '☆'}</button>
      <button class="x" data-a="dex" data-e="${i}" aria-label="Quitar ejercicio">✕</button></div>
      <p class="${last ? 'last' : 'muted'}">${last ? `Última sesión (${fmt(last.date)}): ${esc(setText(last.sets))}` : 'Primera vez con este ejercicio'}</p>
      ${e.sets.map((s, j) => `<div class="set"><span>${j + 1}</span>
        <input inputmode="decimal" data-e="${i}" data-s="${j}" data-f="kg" value="${s.kg ?? ''}" placeholder="${last?.sets[j]?.kg ?? 'kg'}" aria-label="Kilos serie ${j + 1}">
        <input inputmode="numeric" data-e="${i}" data-s="${j}" data-f="reps" value="${s.reps ?? ''}" placeholder="${last?.sets[j]?.reps ?? 'reps'}" aria-label="Repeticiones serie ${j + 1}">
        <button class="x" data-a="dset" data-e="${i}" data-s="${j}" aria-label="Quitar serie">✕</button></div>`).join('')}
      <button class="btn alt" data-a="aset" data-e="${i}">+ Serie</button></section>`; }).join('')}
    <section class="card"><label class="lbl">Añadir ejercicio
      <input id="nex" list="cat" placeholder="Press banca" autocomplete="off"></label>
      <datalist id="cat">${catalog.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
      <div class="chips">${catalog.filter(c => c.favorite).map(c => `<button class="chip" data-a="qex" data-n="${esc(c.name)}">★ ${esc(c.name)}</button>`).join('')}</div>
      <button class="btn alt" data-a="aex">Añadir ejercicio</button></section>
    <section class="card"><label class="lbl">Notas<textarea id="notes" rows="3">${esc(w.notes)}</textarea></label></section>
    <button class="btn" data-a="fin">${draft ? 'Finalizar entrenamiento' : 'Listo'}</button>
    <button class="btn alt" data-a="del">${draft ? 'Descartar borrador' : 'Eliminar entrenamiento'}</button></div>`;
    const ed = view.querySelector('#ed');
    if (focus) ed.querySelector(focus)?.focus();

    ed.addEventListener('focusin', e => e.target.select?.());
    ed.oninput = e => {
      const t = e.target;
      if (t.id === 'notes') w.notes = t.value;
      else if (t.dataset.f) { w.exercises[t.dataset.e].sets[t.dataset.s][t.dataset.f] = parseNum(t.value); ed.querySelector('#vol').textContent = Math.round(volume(w)); }
      else return;
      soon();
    };
    ed.onclick = async e => {
      const t = e.target.closest('[data-a]'); if (!t) return;
      const i = +t.dataset.e, j = +t.dataset.s;
      switch (t.dataset.a) {
        case 'tm': return startTimer(+t.dataset.s);
        case 'fav': { const c = catalog.find(x => x.id === w.exercises[i].exerciseId); if (!c) return; c.favorite = !c.favorite; await DB.put('exercises', c); return render(); }
        case 'aex': case 'qex': {
          const name = (t.dataset.a === 'qex' ? t.dataset.n : ed.querySelector('#nex').value).trim(); if (!name) return ed.querySelector('#nex').focus();
          w.exercises.push({ id: DB.uid(), exerciseId: await ensureExercise(name), name, sets: [{ kg: null, reps: null }] });
          catalog.push(...(await DB.all('exercises')).filter(c => !catalog.some(k => k.id === c.id)));
          await save(); return render(`[data-e="${w.exercises.length - 1}"][data-f="kg"]`);
        }
        case 'aset': {
          const p = w.exercises[i].sets.at(-1) || {}; w.exercises[i].sets.push({ kg: p.kg ?? null, reps: p.reps ?? null });
          await save(); return render(`[data-e="${i}"][data-s="${w.exercises[i].sets.length - 1}"][data-f="kg"]`);
        }
        case 'dset': w.exercises[i].sets.splice(j, 1); await save(); return render();
        case 'dex': if (confirm(`¿Quitar "${w.exercises[i].name}" de este entrenamiento?`)) { w.exercises.splice(i, 1); await save(); render(); } return;
        case 'ren': { const n = prompt('Nombre del ejercicio', w.exercises[i].name)?.trim(); if (!n) return;
          w.exercises[i].name = n; w.exercises[i].exerciseId = await ensureExercise(n); await save(); return render(); }
        case 'fin': w.exercises.forEach(x => x.sets = x.sets.filter(s => s.kg != null || s.reps != null));
          w.status = 'done'; clearTimeout(timer); await save(); location.hash = draft ? '#/inicio' : '#/historial'; return;
        case 'del': if (confirm(draft ? '¿Descartar este borrador?' : '¿Eliminar este entrenamiento para siempre?')) {
          clearTimeout(timer); flush = () => {}; await DB.del('workouts', w.id); location.hash = draft ? '#/inicio' : '#/historial'; } return;
      }
    };
  };
  render();
}
