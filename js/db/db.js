// Capa de datos. Aislada de la interfaz: la UI solo usa las funciones exportadas.
export const APP_VERSION = '0.7.0';
export const SCHEMA_VERSION = 1;
const DB_NAME = 'gymdiary', SAFETY_DB = 'gymdiary_safety';
export const STORES = ['workouts','exercises','routines','measurements','photos','goals','settings','meta'];
let db;

// ---- MIGRACIONES: una función por versión. Nunca borrar stores ni registros. ----
const migrations = {
  1(d) {
    const mk = (n, o, idx = []) => { const s = d.createObjectStore(n, o); idx.forEach(i => s.createIndex(i, i)); };
    mk('workouts', { keyPath: 'id' }, ['date', 'status']);
    mk('exercises', { keyPath: 'id' }, ['name']);
    mk('routines', { keyPath: 'id' });
    mk('measurements', { keyPath: 'id' }, ['date']);
    mk('photos', { keyPath: 'id' }, ['date']);
    mk('goals', { keyPath: 'id' });
    mk('settings', { keyPath: 'key' });
    mk('meta', { keyPath: 'key' });
  },
  // 2(d, tx, old) { ... }  <- las futuras versiones se añaden aquí
};

const p = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
export const uid = () => crypto.randomUUID();
const blobToUrl = b => new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
const urlToBlob = u => fetch(u).then(r => r.blob());

async function dump(d) {
  const out = { app: 'gym-diario', appVersion: APP_VERSION, schemaVersion: d.version, exportedAt: new Date().toISOString(), data: {} };
  for (const s of STORES) {
    if (!d.objectStoreNames.contains(s)) continue;
    let rows = await p(d.transaction(s).objectStore(s).getAll());
    if (s === 'photos') rows = await Promise.all(rows.map(async r => r.blob instanceof Blob ? { ...r, blob: await blobToUrl(r.blob), _blob: 1 } : r));
    out.data[s] = rows;
  }
  return out;
}

// Copia previa en una BD aparte: sobrevive aunque falle una migración.
async function saveSafety(snapshot) {
  const r = indexedDB.open(SAFETY_DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('b', { autoIncrement: true });
  const s = await p(r);
  const tx = s.transaction('b', 'readwrite'), st = tx.objectStore('b');
  st.add({ at: Date.now(), snapshot });
  const keys = await p(st.getAllKeys());
  keys.slice(0, -3).forEach(k => st.delete(k)); // conserva las 3 últimas
  await new Promise(ok => tx.oncomplete = ok);
  s.close();
}

async function storedVersion() {
  const l = indexedDB.databases ? await indexedDB.databases() : [];
  return (l.find(x => x.name === DB_NAME) || {}).version || 0;
}

export async function init() {
  const old = await storedVersion();
  if (old > 0 && old < SCHEMA_VERSION) {
    const cur = await p(indexedDB.open(DB_NAME));
    try { await saveSafety(await dump(cur)); } finally { cur.close(); }
  }
  if (old > SCHEMA_VERSION) db = await p(indexedDB.open(DB_NAME)); // datos más nuevos que el código: no tocar
  else {
    const r = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    r.onupgradeneeded = e => { for (let v = e.oldVersion + 1; v <= SCHEMA_VERSION; v++) migrations[v](r.result, r.transaction, e.oldVersion); };
    db = await p(r); // si una migración falla, IndexedDB revierte y conserva la versión anterior
  }
  db.onversionchange = () => db.close();
  await put('meta', { key: 'schema', version: db.version, appVersion: APP_VERSION, openedAt: Date.now() });
  const persisted = navigator.storage?.persist ? await navigator.storage.persist() : false;
  return { schema: db.version, persisted };
}

// ---- CRUD ----
export const put = (s, o) => p(db.transaction(s, 'readwrite').objectStore(s).put(o));
export const get = (s, k) => p(db.transaction(s).objectStore(s).get(k));
export const del = (s, k) => p(db.transaction(s, 'readwrite').objectStore(s).delete(k));
export const all = s => p(db.transaction(s).objectStore(s).getAll());
export const count = s => p(db.transaction(s).objectStore(s).count());

// ---- Copias de seguridad ----
export const exportAll = () => dump(db);

export function inspectBackup(json) {
  if (json?.app !== 'gym-diario' || !json.data) throw new Error('El archivo no es una copia de Diario de gimnasio.');
  if (json.schemaVersion > SCHEMA_VERSION) throw new Error('La copia es de una versión más nueva de la app. Actualiza la app primero.');
  return { exportedAt: json.exportedAt, counts: Object.fromEntries(STORES.map(s => [s, (json.data[s] || []).length])) };
}

// 'merge': añade lo que falta y NO sobrescribe nada. 'replace': sustituye todo (tras copia automática).
// Si una migración futura cambia la FORMA de los registros, añade aquí dataMigrations[v](data)
// para que las copias JSON antiguas también se puedan importar (de la versión v-1 a la v).
const dataMigrations = {};
const upgradeBackup = j => { for (let v = (j.schemaVersion || 1) + 1; v <= SCHEMA_VERSION; v++) dataMigrations[v]?.(j.data); return j; };

const openSafety = () => { const r = indexedDB.open(SAFETY_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('b', { autoIncrement: true }); return p(r); };
export async function listSafety() {
  const s = await openSafety(), st = s.transaction('b').objectStore('b');
  const [keys, rows] = await Promise.all([p(st.getAllKeys()), p(st.getAll())]); s.close();
  return rows.map((r, i) => ({ key: keys[i], at: r.at, workouts: r.snapshot.data.workouts?.length || 0 })).sort((a, b) => b.at - a.at);
}
export async function restoreSafety(key) {
  const s = await openSafety(), row = await p(s.transaction('b').objectStore('b').get(key)); s.close();
  if (!row) throw new Error('No se encontró esa copia automática.');
  await importBackup(row.snapshot, 'replace');
}

export async function importBackup(json, mode) {
  inspectBackup(json); json = upgradeBackup(json);
  await saveSafety(await dump(db));
  for (const s of STORES) {
    if (s === 'meta') continue;
    let rows = json.data[s] || [];
    if (s === 'photos') rows = await Promise.all(rows.map(async r => r._blob ? { ...r, blob: await urlToBlob(r.blob), _blob: undefined } : r));
    const keyPath = db.transaction(s).objectStore(s).keyPath;
    let existing = new Set();
    if (mode === 'merge') existing = new Set((await all(s)).map(r => r[keyPath]));
    const tx = db.transaction(s, 'readwrite'), st = tx.objectStore(s);
    if (mode === 'replace') st.clear();
    for (const r of rows) if (!existing.has(r[keyPath])) st.put(r);
    await new Promise((ok, ko) => { tx.oncomplete = ok; tx.onerror = () => ko(tx.error); });
  }
}
