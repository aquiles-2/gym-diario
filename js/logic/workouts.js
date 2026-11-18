// Lógica pura (sin DOM ni IndexedDB): fácil de probar y de reutilizar en Historial y Progreso.
export const norm = s => String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const today = () => new Date().toLocaleDateString('sv');
export const parseNum = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
export const validSets = e => e.sets.filter(s => s.kg != null && s.reps != null && s.reps > 0);
export const volume = w => w.exercises.reduce((t, e) => t + validSets(e).reduce((a, s) => a + s.kg * s.reps, 0), 0);
export const setText = sets => sets.map(s => `${s.kg ?? '–'} kg × ${s.reps ?? '–'}`).join(' · ');

// Última sesión terminada (distinta de la actual) en la que aparece ese ejercicio.
export function lastSession(workouts, name, date, excludeId) {
  const n = norm(name);
  const c = workouts.filter(w => w.status === 'done' && w.id !== excludeId && w.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  for (const w of c) {
    const e = w.exercises.find(x => norm(x.name) === n && validSets(x).length);
    if (e) return { date: w.date, sets: validSets(e) };
  }
  return null;
}

// ---- Fase 5: calendario, duplicar y comparar ----
const pad = n => String(n).padStart(2, '0');
export function monthGrid(y, m) { // semana empezando en lunes; null = hueco
  const cells = Array((new Date(y, m, 1).getDay() + 6) % 7).fill(null);
  for (let d = 1, n = new Date(y, m + 1, 0).getDate(); d <= n; d++) cells.push(`${y}-${pad(m + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function duplicateWorkout(w, date, uid) { // la plantilla es una copia: no modifica el original
  const now = Date.now();
  return { id: uid(), date, name: w.name, status: 'draft', notes: '', createdAt: now, updatedAt: now,
    exercises: w.exercises.map(e => ({ id: uid(), exerciseId: e.exerciseId, name: e.name, sets: e.sets.map(s => ({ kg: s.kg, reps: s.reps })) })) };
}
const stats = e => { const s = validSets(e); return { maxKg: Math.max(...s.map(x => x.kg)), vol: s.reduce((t, x) => t + x.kg * x.reps, 0) }; };
// Compara los ejercicios que aparecen en ambos entrenamientos (delta = B − A).
export function compare(a, b) {
  const rows = [];
  for (const ea of a.exercises) {
    const eb = b.exercises.find(x => norm(x.name) === norm(ea.name));
    if (!eb || !validSets(ea).length || !validSets(eb).length) continue;
    const sa = stats(ea), sb = stats(eb);
    rows.push({ name: ea.name, a: sa, b: sb, dKg: sb.maxKg - sa.maxKg, dVol: sb.vol - sa.vol });
  }
  return rows;
}
