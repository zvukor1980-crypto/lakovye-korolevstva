/** Слоты сохранений: IndexedDB и запасной localStorage. */

const DB = "lakovye-korolevstva";
const STORE = "slots";

function memory() {
  try {
    const raw = localStorage.getItem("lk-slots");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function memoryWrite(all) {
  localStorage.setItem("lk-slots", JSON.stringify(all));
}

function idb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) { reject(new Error("no idb")); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbOp(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listSaves() {
  try {
    const db = await idb();
    const keys = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const out = [];
    for (const k of keys) {
      const v = await idbOp("readonly", (s) => s.get(k));
      if (v) out.push({ slot: String(k), ...v, data: undefined });
    }
    return out.sort((a, b) => String(a.slot).localeCompare(String(b.slot)));
  } catch {
    const all = memory();
    return Object.keys(all).map((slot) => ({ slot, ...all[slot], data: undefined }));
  }
}

export async function readSave(slot) {
  try {
    const v = await idbOp("readonly", (s) => s.get(String(slot)));
    if (v) return v;
  } catch { /* fallback */ }
  return memory()[String(slot)] || null;
}

export async function writeSave(slot, meta) {
  const rec = { ...meta, updated: Date.now() };
  try {
    await idbOp("readwrite", (s) => s.put(rec, String(slot)));
  } catch { /* ignore */ }
  const all = memory();
  all[String(slot)] = rec;
  try { memoryWrite(all); } catch { /* quota */ }
}

export async function deleteSave(slot) {
  try { await idbOp("readwrite", (s) => s.delete(String(slot))); } catch { /* ignore */ }
  const all = memory();
  delete all[String(slot)];
  try { memoryWrite(all); } catch { /* ignore */ }
}
