import * as DB from '../db/db.js';
import { today, volume } from '../logic/workouts.js';
import { exerciseNames, exerciseSeries, records, compareRanges, weeklyVolume, inRange } from '../logic/stats.js';
import { lineChart } from './chart.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const short = d => new Date(d + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
const sign = n => (n > 0 ? '+' : '') + Math.round(n);
const cls = n => n > 0 ? 'up' : n < 0 ? 'dn' : '';
const M = { maxKg: ['Peso máx.', 'kg'], reps: ['Repeticiones', 'reps'], vol: ['Volumen', 'kg'] };
const R = [[1, '1 mes'], [3, '3 meses'], [6, '6 meses'], [12, '1 año'], [0, 'Todo']];
const MORE = '<div class="row3"><a class="btn alt" href="#/medidas">Medidas</a><a class="btn alt" href="#/fotos">Fotos</a><a class="btn alt" href="#/objetivos">Objetivos</a></div>';
let ui = { ex: null, metric: 'maxKg', months: 6 };

export async function progreso() {
  const view = document.querySelector('#view');
  const ws = (await DB.all('workouts')).filter(w => w.status === 'done'), names = exerciseNames(ws), td = today();
  if (!ws.length) { view.innerHTML = '<header><h1>Progreso</h1></header>' + MORE + '<section class="card"><h2>Aún no hay datos</h2><p class="muted">Finaliza tu primer entrenamiento y aquí verás tu evolución real.</p></section>'; return; }
  if (!names.includes(ui.ex)) ui.ex = names[0];

  const cmpRow = (t, o) => { const d = o.cur.vol - o.prev.vol; return `<p class="exl"><b>${t}</b><br>Volumen: ${Math.round(o.prev.vol)} → ${Math.round(o.cur.vol)} kg <b class="${cls(d)}">(${sign(d)})</b><br>
    Entrenamientos: ${o.prev.count} → ${o.cur.count}</p>`; };
  const draw = () => {
    const c = compareRanges(ws, td), wk = weeklyVolume(ws, 12, td), wkN = wk.filter(p => p.vol > 0).length;
    const ser = inRange(exerciseSeries(ws, ui.ex), ui.months, td), rec = records(ws, ui.ex);
    const rl = (t, r, f) => r ? `<p class="exl"><span class="muted">${t}</span><br><b>${f(r)}</b> <span class="muted">· ${short(r.date)}</span></p>` : '';
    view.innerHTML = `<header><h1>Progreso</h1></header>${MORE}<div id="prog">
    <section class="stats"><div><b>${Math.round(ws.reduce((t, w) => t + volume(w), 0)).toLocaleString('es-ES')}</b>kg levantados</div><div><b>${ws.length}</b>entrenamientos</div></section>
    <section class="card"><h2>Esta semana vs anterior</h2>${cmpRow('Semana', c.week)}${cmpRow('Mes', c.month)}</section>
    <section class="card"><h2>Volumen por semana</h2>${wkN >= 2 ? lineChart(wk.map(p => ({ x: p.date, y: p.vol })), 'kg') : '<p class="muted">Se necesitan al menos 2 semanas con entrenamientos para dibujar la evolución.</p>'}</section>
    <h2 class="sec">Por ejercicio</h2><section class="card">
    <select data-k="ex" aria-label="Ejercicio">${names.map(n => `<option ${n === ui.ex ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div class="chips" style="margin-top:12px">${Object.entries(M).map(([k, [l]]) => `<button class="chip ${ui.metric === k ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}</div>
    <div class="chips" style="margin-top:8px">${R.map(([m, l]) => `<button class="chip ${ui.months === m ? 'on' : ''}" data-r="${m}">${l}</button>`).join('')}</div>
    <div style="margin-top:12px">${ser.length >= 2 ? lineChart(ser.map(p => ({ x: p.date, y: p[ui.metric] })), M[ui.metric][1])
      : `<p class="muted">${ser.length} sesión(es) de este ejercicio en este periodo. Se necesitan al menos 2 para dibujar la evolución.</p>`}</div></section>
    ${rec ? `<section class="card"><h2>Récords: ${esc(ui.ex)}</h2>
      ${rl('Peso máximo', rec.maxKg, r => `${r.kg} kg × ${r.reps}`)}${rl('Más repeticiones en una serie', rec.maxReps, r => `${r.reps} × ${r.kg} kg`)}
      ${rl('1RM estimado (orientativo)', rec.best1, r => `${Math.round(r.v * 10) / 10} kg`)}${rl('Mejor volumen en una sesión', rec.bestVol && { ...rec.bestVol }, r => `${Math.round(r.vol)} kg`)}
      <p class="muted">${rec.sessions} sesión(es) registradas</p></section>` : ''}
    <h2 class="sec">Todos los récords</h2><section class="card">${names.map(n => { const r = records(ws, n).maxKg;
      return `<p class="exl"><b>${esc(n)}</b><br><span class="muted">${r.kg} kg × ${r.reps} · ${short(r.date)}</span></p>`; }).join('')}</section></div>`;
    const root = view.querySelector('#prog');
    root.onclick = e => { const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.m) ui.metric = t.dataset.m; else if (t.dataset.r != null) ui.months = +t.dataset.r; else return; draw(); };
    root.onchange = e => { if (e.target.dataset.k) { ui.ex = e.target.value; draw(); } };
  };
  draw();
}
