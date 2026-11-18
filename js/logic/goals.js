// Objetivos y medidas: lógica pura.
const r1 = n => Math.round(n * 10) / 10;
export function measurementSeries(ms, field) { // un punto por fecha (el último guardado), solo valores reales
  const by = new Map();
  for (const m of [...ms].sort((a, b) => a.createdAt - b.createdAt)) if (m[field] != null) by.set(m.date, { date: m.date, y: m[field] });
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}
// ctx: { maxKg(nombre) -> número, weekCount, latestWeight }
export function goalProgress(g, ctx) {
  if (g.kind === 'lift') { const cur = ctx.maxKg(g.exercise) || 0;
    return { text: `${g.exercise}: ${r1(cur)} / ${g.target} kg`, pct: Math.min(100, cur / g.target * 100), reached: cur >= g.target }; }
  if (g.kind === 'freq') { const cur = ctx.weekCount;
    return { text: `Esta semana: ${cur} / ${g.target} entrenamientos`, pct: Math.min(100, cur / g.target * 100), reached: cur >= g.target }; }
  const cur = ctx.latestWeight; if (cur == null) return { text: 'Aún sin peso registrado', pct: 0, reached: false };
  const up = g.target >= g.start, reached = up ? cur >= g.target : cur <= g.target;
  const pct = g.start === g.target ? 100 : Math.max(0, Math.min(100, (cur - g.start) / (g.target - g.start) * 100));
  return { text: `Peso corporal: ${r1(cur)} kg → objetivo ${g.target} kg`, pct, reached };
}
