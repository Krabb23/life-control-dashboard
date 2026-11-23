import { db, onChange, getLocal, setLocal, SYNCED } from '../db';
import { api, serverCfg, uploadFile } from './api';

// Синхронизация: локальные правки копятся в очереди и уходят на сервер, оттуда приходят чужие правки.
// Конфликт решается по времени правки: побеждает последняя.
interface WireRow { t: string; id: string; u: number; d: 0 | 1; data: Record<string, unknown> }

let running = false, again = false, timer: number | undefined;

export async function syncNow(): Promise<{ sent: number; got: number } | null> {
  if (!(await serverCfg()) || !navigator.onLine) return null;
  if (running) { again = true; return null; }
  running = true;
  try {
    const out = await db.outbox.toArray();
    const changes: WireRow[] = [];
    for (const o of out) {
      const row = await db.table(o.table).get(o.id);
      if (row) changes.push({ t: o.table, id: o.id, u: row.updatedAt, d: row.deleted ? 1 : 0, data: row });
    }
    const since = await getLocal<number>('syncRev', 0);
    const res = await api<{ rev: number; changes: WireRow[] }>('/sync', { since, changes });
    // убираем из очереди только то, что не менялось за время запроса
    await db.transaction('rw', [db.outbox, ...SYNCED.map(t => db.table(t))], async () => {
      for (const c of changes) {
        const cur = await db.table(c.t).get(c.id);
        if (cur && cur.updatedAt === c.u) await db.outbox.delete(c.t + ':' + c.id);
      }
      for (const c of res.changes) {
        if (!(SYNCED as readonly string[]).includes(c.t)) continue;
        const cur = await db.table(c.t).get(c.id);
        if (!cur || cur.updatedAt <= c.u) await db.table(c.t).put({ ...c.data, id: c.id, updatedAt: c.u, deleted: c.d });
      }
    });
    await setLocal('syncRev', res.rev);
    await setLocal('syncAt', Date.now());
    await uploadPending();
    return { sent: changes.length, got: res.changes.length };
  } finally {
    running = false;
    if (again) { again = false; schedule(500); }
  }
}

async function uploadPending() {
  const files = await db.files.where('uploaded').equals(0).toArray();
  for (const f of files) {
    try { await uploadFile(f.id, f.blob); await db.files.update(f.id, { uploaded: 1 }); } catch { /* попробуем позже */ }
  }
}

function schedule(ms: number) {
  clearTimeout(timer);
  timer = window.setTimeout(() => { syncNow().catch(() => {}); }, ms);
}

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  onChange(() => schedule(1500));
  addEventListener('online', () => schedule(300));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(200); });
  setInterval(() => schedule(0), 60_000);
  schedule(800);
}
