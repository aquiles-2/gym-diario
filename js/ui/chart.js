// Gráfica de líneas en SVG, sin librerías. Recibe solo puntos reales [{x:'AAAA-MM-DD', y:número}].
const nice = v => Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
const lab = s => new Date(s + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
export function lineChart(pts, unit = '') {
  const W = 340, H = 210, L = 42, R = 12, T = 14, B = 28, t = d => new Date(d + 'T00:00').getTime();
  const x0 = t(pts[0].x), span = (t(pts.at(-1).x) - x0) || 1;
  let lo = Math.min(...pts.map(p => p.y)), hi = Math.max(...pts.map(p => p.y));
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * .12; lo = Math.max(0, lo - pad); hi += pad;
  const X = v => L + (v - x0) / span * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const grid = [0, 1, 2].map(k => { const v = lo + (hi - lo) * k / 2; return `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/><text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" fill="var(--mu)" font-size="11">${nice(v)}</text>`; }).join('');
  const xy = pts.map(p => `${X(t(p.x)).toFixed(1)},${Y(p.y).toFixed(1)}`);
  const dots = pts.map((p, i) => `<circle cx="${xy[i].split(',')[0]}" cy="${xy[i].split(',')[1]}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="var(--ac)"><title>${lab(p.x)}: ${nice(p.y)} ${unit}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de evolución, ${pts.length} puntos" style="width:100%;height:auto">${grid}
  <polyline points="${xy.join(' ')}" fill="none" stroke="var(--ac)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}
  <text x="${L}" y="${H - 8}" fill="var(--mu)" font-size="11">${lab(pts[0].x)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end" fill="var(--mu)" font-size="11">${lab(pts.at(-1).x)}</text></svg>`;
}
