import * as DB from './db/db.js';
import { entrenar } from './ui/entrenar.js';
import { historial } from './ui/historial.js';
import { progreso } from './ui/progreso.js';
import { rutinas, rutina } from './ui/rutinas.js';
import './ui/timer.js';
import { medidas, fotos, objetivos } from './ui/extras.js';

const $ = s => document.querySelector(s), view = $('#view');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const fmt = d => new Date(d + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
let info = { schema: '?', persisted: false };
const mondayISO = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toLocaleDateString('sv'); };

async function inicio() {
  const allW = await DB.all('workouts'), draft = allW.find(x => x.status === 'draft');
  const w = allW.filter(x => x.status === 'done').sort((a, b) => b.date.localeCompare(a.date));
  const h = new Date().getHours(), hi = h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const lb = await DB.get('settings', 'lastBackup'), days = lb ? (Date.now() - lb.at) / 864e5 : Infinity;
  const remind = w.length > 0 && days > 14;
  const week = w.filter(x => x.date >= mondayISO()).length;
  view.innerHTML = `<header><h1>${hi}</h1><a class="ico" href="#/ajustes" aria-label="Ajustes">⚙</a></header>
  <section class="hero"><span>Último entrenamiento</span><strong>${w[0] ? esc(fmt(w[0].date)) : 'Aún no hay ninguno'}</strong></section>
  <section class="stats"><div><b>${week}</b>esta semana</div><div><b>${w.length}</b>en total</div></section>
  <a class="btn" href="#/entrenar">${draft ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}</a>
  ${remind ? `<section class="card"><h2>Haz una copia de seguridad</h2><p class="muted">${lb ? `Hace ${Math.floor(days)} días de tu última copia.` : 'Todavía no has hecho ninguna copia.'} Si borras los datos del navegador, se pierden tus entrenamientos.</p><a class="btn alt" href="#/ajustes">Ir a copias de seguridad</a></section>` : ''}
  <section class="card"><h2>Progreso reciente</h2><p class="muted">${w.length < 2 ? 'Registra al menos dos sesiones del mismo ejercicio para ver tu evolución.' : 'Disponible en la sección Progreso.'}</p></section>`;
}

async function ajustes() {
  const [c, lb, saf, est] = await Promise.all([Promise.all(DB.STORES.slice(0, 4).map(DB.count)), DB.get('settings', 'lastBackup'), DB.listSafety(), navigator.storage?.estimate?.() ?? {}]);
  const mb = n => (n / 1048576).toFixed(1), canShare = !!navigator.share;
  view.innerHTML = `<header><a class="ico" href="#/inicio" aria-label="Volver">‹</a><h1>Ajustes</h1></header>
  <section class="card"><h2>Versión</h2><p>App ${DB.APP_VERSION} · Base de datos v${info.schema}</p>
  <p class="muted">Almacenamiento persistente: ${info.persisted ? 'concedido' : 'no concedido (haz copias JSON con frecuencia)'}</p>
  <p class="muted">Espacio usado: ${est.usage ? mb(est.usage) + ' MB' : 'desconocido'}</p></section>
  <section class="card"><h2>Copia de seguridad</h2>
  <p class="muted">${c[0]} entrenamientos · ${c[1]} ejercicios · ${c[2]} rutinas · ${c[3]} medidas</p>
  <p class="muted">Última copia: ${lb ? new Date(lb.at).toLocaleDateString('es-ES') : 'nunca'}</p>
  <button class="btn" id="exp">Exportar copia (JSON)</button>
  ${canShare ? '<button class="btn alt" id="shr">Compartir copia (Drive, WhatsApp…)</button>' : ''}
  <label class="btn alt">Importar copia<input id="imp" type="file" accept="application/json,.json" hidden></label><p id="msg" class="muted"></p></section>
  ${saf.length ? `<section class="card"><h2>Copias automáticas</h2><p class="muted">Se crean solas antes de importar o de actualizar la base de datos. Se conservan las 3 últimas.</p>
  ${saf.map(s => `<p>${new Date(s.at).toLocaleString('es-ES')} · ${s.workouts} entrenamientos <button class="chip" data-r="${s.key}">Restaurar</button></p>`).join('')}</section>` : ''}`;
  const backup = async share => {
    const j = await DB.exportAll(), name = `gym-diario-${new Date().toLocaleDateString('sv')}.json`, blob = new Blob([JSON.stringify(j)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
    await DB.put('settings', { key: 'lastBackup', at: Date.now() });
    $('#msg').textContent = share ? 'Copia compartida.' : 'Copia guardada en Descargas.';
  };
  $('#exp').onclick = () => backup(false).catch(e => $('#msg').textContent = 'Error: ' + e.message);
  if (canShare) $('#shr').onclick = () => backup(true).catch(e => e.name !== 'AbortError' && ($('#msg').textContent = 'Error: ' + e.message));
  $('#imp').onchange = async e => {
    try {
      const j = JSON.parse(await e.target.files[0].text()), r = DB.inspectBackup(j), n = r.counts;
      const txt = `Copia del ${r.exportedAt?.slice(0, 10)}: ${n.workouts} entrenamientos, ${n.routines} rutinas, ${n.exercises} ejercicios.\n\nAceptar = FUSIONAR (añade lo que falta, no sobrescribe nada).\nCancelar = ver otra opción.`;
      const mode = confirm(txt) ? 'merge' : (confirm('¿REEMPLAZAR todos tus datos actuales por los de la copia?\nSe guarda antes una copia automática de lo actual.') ? 'replace' : null);
      if (!mode) return;
      await DB.importBackup(j, mode); $('#msg').textContent = 'Importación completada.'; setTimeout(ajustes, 800);
    } catch (err) { $('#msg').textContent = 'Error: ' + err.message; }
  };
  view.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
    if (!confirm('Se REEMPLAZARÁN tus datos actuales por esta copia automática. Antes se guarda otra copia de lo actual. ¿Continuar?')) return;
    try { await DB.restoreSafety(+b.dataset.r); $('#msg').textContent = 'Copia restaurada.'; setTimeout(ajustes, 800); } catch (err) { $('#msg').textContent = 'Error: ' + err.message; }
  });
}

const routes = { inicio, ajustes,
  entrenar,
  historial,
  progreso, rutinas, rutina, medidas, fotos, objetivos };

async function route() {
  const [r, arg] = (location.hash.replace('#/', '') || 'inicio').split('/');
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === (r.startsWith('rutina') ? 'entrenar' : ['medidas', 'fotos', 'objetivos'].includes(r) ? 'progreso' : r)));
  try { await (routes[r] || inicio)(arg); } catch (e) { view.innerHTML = `<section class="card"><h2>Error</h2><p>${esc(e.message)}</p></section>`; }
  scrollTo(0, 0);
}

function sw() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const ask = w => { const b = $('#banner'); b.hidden = false; b.innerHTML = 'Hay una versión nueva. <button>Actualizar</button>';
      b.querySelector('button').onclick = () => w.postMessage('SKIP_WAITING'); };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing;
      w.addEventListener('statechange', () => w.state === 'installed' && navigator.serviceWorker.controller && ask(w)); });
  });
  const had = !!navigator.serviceWorker.controller; // en la primera instalación no hace falta recargar
  navigator.serviceWorker.addEventListener('controllerchange', () => had && location.reload());
}

(async () => {
  try { info = await DB.init(); }
  catch (e) { view.innerHTML = `<section class="card"><h2>No se pudo abrir la base de datos</h2><p>${esc(e.message)}</p><p class="muted">Tus datos no se han borrado. No reinstales ni borres datos del sitio.</p></section>`; return; }
  addEventListener('hashchange', route); route(); sw();
})();
