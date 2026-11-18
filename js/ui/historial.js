import * as DB from '../db/db.js';
import { today, monthGrid, volume, setText, validSets, compare, duplicateWorkout } from '../logic/workouts.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const fmt = d => new Date(d + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const short = d => new Date(d + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
const sign = n => (n > 0 ? '+' : '') + Math.round(n * 100) / 100;
const cls = n => n > 0 ? 'up' : n < 0 ? 'dn' : '';
let st = null, cmp = {};

export async function historial() {
  const view = document.querySelector('#view');
  const all = (await DB.all('workouts')).filter(w => w.status === 'done')
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  const t = new Date(); st ||= { y: t.getFullYear(), m: t.getMonth(), sel: today() };
  if (!all.some(w => w.id === cmp.a) || !all.some(w => w.id === cmp.b)) { cmp = { a: all[1]?.id, b: all[0]?.id }; }

  const draw = () => {
    const days = new Set(all.map(w => w.date)), day = all.filter(w => w.date === st.sel);
    const mes = new Date(st.y, st.m, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const opts = id => all.map(w => `<option value="${w.id}" ${w.id === id ? 'selected' : ''}>${short(w.date)} · ${esc(w.name)}</option>`).join('');
    const A = all.find(w => w.id === cmp.a), B = all.find(w => w.id === cmp.b), rows = A && B ? compare(A, B) : [];
    view.innerHTML = `<header><h1>Historial</h1></header><div id="hist">
    <section class="card"><div class="calh"><button class="x" data-a="prev" aria-label="Mes anterior">‹</button><b>${mes}</b><button class="x" data-a="next" aria-label="Mes siguiente">›</button></div>
    <div class="cal">${'LMXJVSD'.split('').map(d => `<i>${d}</i>`).join('')}${monthGrid(st.y, st.m).map(d => d
      ? `<button data-d="${d}" class="${days.has(d) ? 'has ' : ''}${d === st.sel ? 'sel ' : ''}${d === today() ? 'td' : ''}">${+d.slice(8)}</button>` : '<span></span>').join('')}</div></section>
    <h2 class="sec">${esc(fmt(st.sel))}</h2>
    ${day.length ? day.map(w => `<section class="card"><b>${esc(w.name)}</b> <span class="muted">· ${Math.round(volume(w))} kg de volumen</span>
      ${w.exercises.map(e => `<p class="exl"><b>${esc(e.name)}</b><br><span class="muted">${validSets(e).length ? esc(setText(validSets(e))) : 'Sin series'}</span></p>`).join('')}
      ${w.notes ? `<p class="muted">📝 ${esc(w.notes)}</p>` : ''}
      <div class="row3"><a class="btn alt" href="#/entrenar/${w.id}">Editar</a><button class="btn alt" data-a="dup" data-id="${w.id}">Duplicar</button><button class="btn alt" data-a="del" data-id="${w.id}">Eliminar</button></div></section>`).join('')
      : '<section class="card"><p class="muted">No hay entrenamientos este día.</p></section>'}
    <h2 class="sec">Comparar dos entrenamientos</h2>
    <section class="card">${all.length < 2 ? '<p class="muted">Necesitas al menos dos entrenamientos finalizados para comparar.</p>' : `
      <label class="lbl">A (antes)<select data-c="a">${opts(cmp.a)}</select></label>
      <label class="lbl">B (después)<select data-c="b">${opts(cmp.b)}</select></label>
      ${cmp.a === cmp.b ? '<p class="muted">Elige dos entrenamientos distintos.</p>' : rows.length ? rows.map(r => `<p class="exl"><b>${esc(r.name)}</b><br>
        Peso máx.: ${r.a.maxKg} → ${r.b.maxKg} kg <b class="${cls(r.dKg)}">(${sign(r.dKg)})</b><br>
        Volumen: ${Math.round(r.a.vol)} → ${Math.round(r.b.vol)} kg <b class="${cls(r.dVol)}">(${sign(r.dVol)})</b></p>`).join('')
        : '<p class="muted">No tienen ejercicios en común con series registradas.</p>'}`}</section></div>`;
  };
  draw();

  view.onclick = async e => {
    const t = e.target.closest('button'); if (!t || !view.querySelector('#hist')) return;
    if (t.dataset.d) { st.sel = t.dataset.d; return draw(); }
    const a = t.dataset.a;
    if (a === 'prev' || a === 'next') { st.m += a === 'next' ? 1 : -1; if (st.m < 0) { st.m = 11; st.y--; } if (st.m > 11) { st.m = 0; st.y++; } return draw(); }
    if (a === 'del' && confirm('¿Eliminar este entrenamiento para siempre?\nTe recomiendo tener una copia de seguridad reciente.')) { await DB.del('workouts', t.dataset.id); return historial(); }
    if (a === 'dup') {
      if ((await DB.all('workouts')).some(w => w.status === 'draft')) return alert('Tienes un entrenamiento sin terminar. Finalízalo o descártalo en la pestaña Entrenar antes de duplicar.');
      await DB.put('workouts', duplicateWorkout(all.find(w => w.id === t.dataset.id), today(), DB.uid()));
      location.hash = '#/entrenar';
    }
  };
  view.onchange = e => { if (e.target.dataset.c) { cmp[e.target.dataset.c] = e.target.value; draw(); } };
}
