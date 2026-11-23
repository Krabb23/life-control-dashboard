// Хранилище: все записи приложения в одной таблице D1 (таблица, id, JSON), плюс служебные таблицы.
import type { Env } from './env';

export interface Rec { t: string; id: string; u: number; d: 0 | 1; data: Record<string, unknown> }

async function nextRev(env: Env) {
  const r = await env.DB.prepare('SELECT COALESCE(MAX(rev), 0) AS r FROM records').first<{ r: number }>();
  return (r?.r || 0) + 1;
}

export async function upsert(env: Env, changes: Rec[]) {
  if (!changes.length) return;
  let rev = await nextRev(env);
  const stmt = env.DB.prepare(`INSERT INTO records (tbl, id, data, updated_at, deleted, rev) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(tbl, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev
    WHERE excluded.updated_at > records.updated_at`);
  const batch = changes.map(c => stmt.bind(c.t, c.id, JSON.stringify(c.data), c.u, c.d ? 1 : 0, rev++));
  for (let i = 0; i < batch.length; i += 50) await env.DB.batch(batch.slice(i, i + 50));
}

export async function pull(env: Env, since: number, limit = 3000) {
  const r = await env.DB.prepare('SELECT tbl, id, data, updated_at, deleted, rev FROM records WHERE rev > ?1 ORDER BY rev LIMIT ?2').bind(since, limit)
    .all<{ tbl: string; id: string; data: string; updated_at: number; deleted: number; rev: number }>();
  const rows = r.results || [];
  const rev = rows.length ? rows[rows.length - 1].rev : since;
  return { rev, more: rows.length === limit, changes: rows.map(x => ({ t: x.tbl, id: x.id, u: x.updated_at, d: x.deleted as 0 | 1, data: JSON.parse(x.data) })) };
}

// Серверная запись (цифры рекламы, брифинги, разборы)
export const put = (env: Env, t: string, id: string, data: Record<string, unknown>) =>
  upsert(env, [{ t, id, u: Date.now(), d: 0, data: { ...data, id, updatedAt: Date.now() } }]);

export async function get<T>(env: Env, t: string, id: string): Promise<T | null> {
  const r = await env.DB.prepare('SELECT data FROM records WHERE tbl = ?1 AND id = ?2 AND deleted = 0').bind(t, id).first<{ data: string }>();
  return r ? JSON.parse(r.data) as T : null;
}

export async function all<T>(env: Env, t: string): Promise<T[]> {
  const r = await env.DB.prepare('SELECT data FROM records WHERE tbl = ?1 AND deleted = 0').bind(t).all<{ data: string }>();
  return (r.results || []).map(x => JSON.parse(x.data) as T);
}

// Снимок всех нужных таблиц для брифинга и разборов. Векторы не грузим.
export async function snapshot(env: Env) {
  const names = ['tasks', 'habits', 'habitLogs', 'checkins', 'projects', 'adStats', 'txns', 'events', 'goals', 'docs', 'reminders'] as const;
  const out: Record<string, unknown[]> = {};
  await Promise.all(names.map(async n => { out[n] = await all(env, n); }));
  // текст документов для брифинга не нужен
  out.docs = (out.docs as { title: string; fields?: unknown }[]).map(d => ({ title: d.title, fields: d.fields }));
  return out as never;
}

// ---------- файлы ----------
const PART = 1_500_000; // D1: строка до 2 МБ
export async function putFile(env: Env, id: string, body: ArrayBuffer, mime: string) {
  if (env.FILES) { await env.FILES.put(id, body, { httpMetadata: { contentType: mime } }); return; }
  await env.DB.prepare('DELETE FROM files WHERE id = ?1').bind(id).run();
  const parts = [];
  for (let i = 0, n = 0; i < body.byteLength || n === 0; i += PART, n++)
    parts.push(env.DB.prepare('INSERT INTO files (id, part, mime, data) VALUES (?1, ?2, ?3, ?4)').bind(id, n, mime, body.slice(i, i + PART)));
  for (let i = 0; i < parts.length; i += 5) await env.DB.batch(parts.slice(i, i + 5));
}
export async function getFile(env: Env, id: string): Promise<{ body: ArrayBuffer | ReadableStream; mime: string } | null> {
  if (env.FILES) { const o = await env.FILES.get(id); return o ? { body: o.body, mime: o.httpMetadata?.contentType || 'application/octet-stream' } : null; }
  const r = await env.DB.prepare('SELECT part, mime, data FROM files WHERE id = ?1 ORDER BY part').bind(id).all<{ part: number; mime: string; data: ArrayBuffer | number[] }>();
  const rows = r.results || [];
  if (!rows.length) return null;
  const bufs = rows.map(x => (x.data instanceof ArrayBuffer ? new Uint8Array(x.data) : Uint8Array.from(x.data as number[])));
  const out = new Uint8Array(bufs.reduce((a, b) => a + b.length, 0));
  let o = 0; for (const b of bufs) { out.set(b, o); o += b.length; }
  return { body: out.buffer, mime: rows[0].mime };
}

export async function getMeta(env: Env, k: string) {
  return (await env.DB.prepare('SELECT v FROM meta WHERE k = ?1').bind(k).first<{ v: string }>())?.v ?? null;
}
export const setMeta = (env: Env, k: string, v: string) =>
  env.DB.prepare('INSERT INTO meta (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v).run();
