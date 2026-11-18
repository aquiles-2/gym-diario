// Estadísticas puras: solo usan entrenamientos finalizados reales. Nada de datos de ejemplo.
import { norm, validSets, volume } from './workouts.js';
const iso = d => d.toLocaleDateString('sv');
export const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
export const weekStart = s => addDays(s, -((new Date(s + 'T00:00').getDay() + 6) % 7));
const done = ws => ws.filter(w => w.status === 'done');

export function exerciseNames(ws) { // nombre más reciente de cada ejercicio, ordenado por uso
  const m = new Map();
  for (const w of done(ws).sort((a, b) => a.date.localeCompare(b.date)))
    for (const e of w.exercises) if (validSets(e).length) { const k = norm(e.name), o = m.get(k) || { n: 0 }; m.set(k, { name: e.name, n: o.n + 1 }); }
  return [...m.values()].sort((a, b) => b.n - a.n).map(x => x.name);
}

export function exerciseSeries(ws, name) { // un punto por fecha
  const n = norm(name), by = new Map();
  for (const w of done(ws)) for (const e of w.exercises) {
    const s = validSets(e); if (norm(e.name) !== n || !s.length) continue;
    const p = by.get(w.date) || { date: w.date, maxKg: 0, reps: 0, vol: 0 };
    p.maxKg = Math.max(p.maxKg, ...s.map(x => x.kg)); p.reps += s.reduce((t, x) => t + x.reps, 0); p.vol += s.reduce((t, x) => t + x.kg * x.reps, 0);
    by.set(w.date, p);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export const e1rm = (kg, reps) => reps === 1 ? kg : kg * (1 + reps / 30); // Epley, orientativo

export function records(ws, name) {
  const n = norm(name); let maxKg = null, maxReps = null, best1 = null;
  for (const w of done(ws)) for (const e of w.exercises) if (norm(e.name) === n) for (const s of validSets(e)) {
    const r = { kg: s.kg, reps: s.reps, date: w.date };
    if (!maxKg || s.kg > maxKg.kg || (s.kg === maxKg.kg && s.reps > maxKg.reps)) maxKg = r;
    if (!maxReps || s.reps > maxReps.reps || (s.reps === maxReps.reps && s.kg > maxReps.kg)) maxReps = r;
    const v = e1rm(s.kg, s.reps); if (s.kg > 0 && (!best1 || v > best1.v)) best1 = { ...r, v };
  }
  if (!maxKg) return null;
  const ser = exerciseSeries(ws, name), bv = ser.reduce((a, p) => (!a || p.vol > a.vol ? p : a), null);
  return { maxKg, maxReps, best1, bestVol: bv && { vol: bv.vol, date: bv.date }, sessions: ser.length };
}

export const periodVolume = (ws, from, to) => { const p = done(ws).filter(w => w.date >= from && w.date < to); return { vol: p.reduce((t, w) => t + volume(w), 0), count: p.length }; };

export function compareRanges(ws, today) {
  const w0 = weekStart(today), mo = today.slice(0, 7) + '-01', nm = new Date(+today.slice(0, 4), +today.slice(5, 7), 1), pm = new Date(+today.slice(0, 4), +today.slice(5, 7) - 2, 1);
  return { week: { cur: periodVolume(ws, w0, addDays(w0, 7)), prev: periodVolume(ws, addDays(w0, -7), w0) },
    month: { cur: periodVolume(ws, mo, iso(nm)), prev: periodVolume(ws, iso(pm), mo) } };
}

export function weeklyVolume(ws, n, today) { // últimas n semanas, la actual incluida
  const w0 = weekStart(today);
  return Array.from({ length: n }, (_, i) => { const s = addDays(w0, -7 * (n - 1 - i)); return { date: s, vol: periodVolume(ws, s, addDays(s, 7)).vol }; });
}

export function inRange(series, months, today) {
  if (!months) return series;
  const d = new Date(today + 'T00:00'); d.setMonth(d.getMonth() - months);
  return series.filter(p => p.date >= iso(d));
}
