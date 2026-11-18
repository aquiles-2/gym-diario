import * as DB from '../db/db.js';
import { routineToWorkout, duplicateRoutine, moveItem } from '../logic/routines.js';
import { today, norm } from '../logic/workouts.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const hasDraft = async () => (await DB.all('workouts')).some(w => w.status === 'draft');

export async function rutinas() {
  const view = document.querySelector('#view');
  const rs = (await DB.all('routines')).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  view.innerHTML = `<header><a class="ico" href="#/entrenar" aria-label="Volver">‹</a><h1>Rutinas</h1></header><div id="rt">
  ${rs.length ? rs.map(r => `<section class="card"><b>${esc(r.name)}</b>
    <p class="muted">${r.exercises.map(e => `${esc(e.name)} (${e.sets})`).join(' · ') || 'Sin ejercicios'}</p>
    <button class="btn" data-a="go" data-id="${r.id}">Empezar</button>
    <div class="row3"><a class="btn alt" href="#/rutina/${r.id}">Editar</a><button class="btn alt" data-a="dup" data-id="${r.id}">Duplicar</button><button class="btn alt" data-a="del" data-id="${r.id}">Eliminar</button></div></section>`).join('')
    : '<section class="card"><p class="muted">Aún no tienes rutinas. Crea la primera.</p></section>'}
  <button class="btn" data-a="new">Nueva rutina</button></div>`;
  view.querySelector('#rt').onclick = async e => {
    const t = e.target.closest('button'); if (!t) return; const r = rs.find(x => x.id === t.dataset.id);
    switch (t.dataset.a) {
      case 'new': { const now = Date.now(), n = { id: DB.uid(), name: 'Nueva rutina', exercises: [], createdAt: now, updatedAt: now };
        await DB.put('routines', n); location.hash = `#/rutina/${n.id}`; return; }
      case 'dup': await DB.put('routines', duplicateRoutine(r, DB.uid)); return rutinas();
      case 'del': if (confirm(`¿Eliminar la rutina "${r.name}"? Tus entrenamientos ya registrados no se tocan.`)) { await DB.del('routines', r.id); rutinas(); } return;
      case 'go':
        if (!r.exercises.length) return alert('Esta rutina no tiene ejercicios. Edítala primero.');
        if (await hasDraft()) return alert('Tienes un entrenamiento sin terminar. Finalízalo o descártalo en Entrenar antes de empezar otro.');
        await DB.put('workouts', routineToWorkout(r, today(), DB.uid)); location.hash = '#/entrenar';
    }
  };
}

export async function rutina(id) {
  const view = document.querySelector('#view'), r = await DB.get('routines', id);
  if (!r) { location.hash = '#/rutinas'; return; }
  const catalog = await DB.all('exercises');
  const save = () => { r.updatedAt = Date.now(); return DB.put('routines', r); };
  let timer; const soon = () => { clearTimeout(timer); timer = setTimeout(save, 250); };
  addEventListener('pagehide', () => { clearTimeout(timer); save(); }, { once: true });
  const draw = () => {
    view.innerHTML = `<header><a class="ico" href="#/rutinas" aria-label="Volver">‹</a><h1>Editar rutina</h1></header><div id="re">
    <section class="card"><label class="lbl">Nombre<input id="rn" value="${esc(r.name)}"></label></section>
    ${r.exercises.map((e, i) => `<section class="card"><div class="exh"><b class="lnk">${i + 1}. ${esc(e.name)}</b>
      <button class="x" data-a="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
      <button class="x" data-a="dn" data-i="${i}" ${i === r.exercises.length - 1 ? 'disabled' : ''} aria-label="Bajar">▼</button>
      <button class="x" data-a="rm" data-i="${i}" aria-label="Quitar">✕</button></div>
      <div class="step"><button class="x" data-a="m" data-i="${i}" aria-label="Menos series">−</button><span>${e.sets} series</span><button class="x" data-a="p" data-i="${i}" aria-label="Más series">+</button></div></section>`).join('')}
    <section class="card"><label class="lbl">Añadir ejercicio<input id="nex" list="cat" placeholder="Press banca" autocomplete="off"></label>
    <datalist id="cat">${catalog.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist><button class="btn alt" data-a="add">Añadir ejercicio</button></section></div>`;
    const ed = view.querySelector('#re');
    ed.oninput = e => { if (e.target.id === 'rn') { r.name = e.target.value.trim() || 'Rutina'; soon(); } };
    ed.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return; const i = +t.dataset.i;
      switch (t.dataset.a) {
        case 'up': r.exercises = moveItem(r.exercises, i, -1); break;
        case 'dn': r.exercises = moveItem(r.exercises, i, 1); break;
        case 'rm': r.exercises.splice(i, 1); break;
        case 'm': r.exercises[i].sets = Math.max(1, r.exercises[i].sets - 1); break;
        case 'p': r.exercises[i].sets = Math.min(12, r.exercises[i].sets + 1); break;
        case 'add': { const name = ed.querySelector('#nex').value.trim(); if (!name) return ed.querySelector('#nex').focus();
          let ex = catalog.find(c => norm(c.name) === norm(name));
          if (!ex) { ex = { id: DB.uid(), name, favorite: false, createdAt: Date.now() }; await DB.put('exercises', ex); catalog.push(ex); }
          r.exercises.push({ exerciseId: ex.id, name: ex.name, sets: 3 }); break; }
        default: return;
      }
      clearTimeout(timer); await save(); draw();
    };
  };
  draw();
}
