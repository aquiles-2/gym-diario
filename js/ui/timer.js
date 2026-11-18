// Temporizador de descanso. Vive fuera de las pantallas: sigue contando si cambias de pestaña.
let end = 0, iv = null, finished = false;
const el = () => document.querySelector('#timer') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'timer' }));
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export function startTimer(s) { end = Date.now() + s * 1000; finished = false; clearInterval(iv); iv = setInterval(tick, 250); tick(); }
export function stopTimer() { clearInterval(iv); end = 0; finished = false; el().hidden = true; }
function tick() {
  const left = Math.ceil((end - Date.now()) / 1000), t = el();
  if (left <= 0) { clearInterval(iv); if (!finished) { finished = true; navigator.vibrate?.([300, 150, 300]); }
    t.hidden = false; t.innerHTML = '<b>¡Descanso terminado!</b><button data-t="x">Cerrar</button>'; return; }
  t.hidden = false;
  t.innerHTML = `<b>⏱ ${fmt(left)}</b><span><button data-t="-">−15</button><button data-t="+">+15</button><button data-t="x">✕</button></span>`;
}
document.addEventListener('click', e => { const t = e.target.closest('#timer button'); if (!t) return;
  if (t.dataset.t === 'x') stopTimer(); else { end += (t.dataset.t === '+' ? 15 : -15) * 1000; tick(); } });
