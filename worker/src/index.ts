// Сервер Лайф Сити на Cloudflare Workers (бесплатный тариф).
import type { Env } from './env';
import { upsert, pull, put, putFile, getFile, all, type Rec } from './store';
import { embed, LimitError } from './gemini';
import { ask, extract } from './ai';
import { pushAll, runBriefing, runReview, scheduled, runReminders } from './jobs';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-max-age': '86400' };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
const err = (m: string, status = 400) => new Response(m, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS } });

// Сравнение ключа без утечки по времени
function safeEq(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

const SYNCED = new Set(['tasks', 'events', 'reminders', 'habits', 'habitLogs', 'checkins', 'goals', 'projects', 'adStats', 'txns', 'catRules', 'docs', 'lib', 'chunks', 'reviews', 'briefings', 'chat', 'settings']);

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url), p = url.pathname, m = req.method;
  if (m === 'OPTIONS') return new Response(null, { headers: CORS });
  if (p === '/' && m === 'GET') return err('Лайф Сити: сервер работает', 200);
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!safeEq(auth, env.APP_TOKEN)) return err('unauthorized', 401);

  if (p === '/ping') return json({ ok: true, ai: !!env.GEMINI_API_KEY, push: !!env.VAPID_PUBLIC, files: env.FILES ? 'r2' : 'd1' });

  if (p === '/sync' && m === 'POST') {
    const b = await req.json() as { since: number; changes: Rec[] };
    const ok = (b.changes || []).filter(c => SYNCED.has(c.t) && typeof c.id === 'string' && typeof c.u === 'number');
    await upsert(env, ok);
    return json(await pull(env, Number(b.since) || 0));
  }

  if (p.startsWith('/files/')) {
    const id = decodeURIComponent(p.slice(7));
    if (!/^[\w.\-]{1,200}$/.test(id)) return err('bad id');
    if (m === 'PUT') { await putFile(env, id, await req.arrayBuffer(), req.headers.get('content-type') || 'application/octet-stream'); return json({ ok: true }); }
    const f = await getFile(env, id);
    return f ? new Response(f.body, { headers: { 'content-type': f.mime, ...CORS } }) : err('not found', 404);
  }

  if (p.startsWith('/ai/')) {
    if (!env.GEMINI_API_KEY) return err('ИИ не подключён: на сервере нет ключа Gemini', 503);
    try {
      const b = await req.json() as Record<string, unknown>;
      if (p === '/ai/ask') return json(await ask(env, b as never));
      if (p === '/ai/embed') return json({ vectors: await embed(env, (b.texts as string[]).slice(0, 64)) });
      if (p === '/ai/extract') return json(await extract(env, b as Record<string, string>));
    } catch (e) {
      if (e instanceof LimitError) return err('limit', 429);
      return err((e as Error).message || 'ИИ не ответил', 502);
    }
  }

  if (p === '/push/key') return json({ key: env.VAPID_PUBLIC });
  if (p === '/push/subscribe' && m === 'POST') {
    const b = await req.json() as { sub: { endpoint: string }; device: string };
    if (!b.sub?.endpoint?.startsWith('https://')) return err('bad subscription');
    await env.DB.prepare('INSERT INTO push_subs (endpoint, data, device, created) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(endpoint) DO UPDATE SET data = excluded.data, device = excluded.device')
      .bind(b.sub.endpoint, JSON.stringify(b.sub), b.device || '', Date.now()).run();
    return json({ ok: true });
  }
  if (p === '/push/test' && m === 'POST') return json({ sent: await pushAll(env, { title: 'Лайф Сити', body: 'Уведомления работают', url: './#/city' }) });

  // Робот Meta (GitHub Actions) берёт список проектов и присылает цифры
  if (p === '/ads/projects') return json({ projects: (await all<{ id: string; name: string; adAccountId: string; leadActions: string; active: number }>(env, 'projects')).filter(x => x.active && x.adAccountId) });
  if (p === '/ads/ingest' && m === 'POST') {
    const b = await req.json() as { stats: Record<string, unknown>[] };
    for (const s of b.stats || []) await put(env, 'adStats', `${s.projectId}:${s.date}`, s);
    return json({ ok: true, n: (b.stats || []).length });
  }
  if (p === '/ads/refresh' && m === 'POST') {
    if (!env.GH_TOKEN) return json({ ok: false, note: 'Кнопка заработает, когда на сервер добавят ключ GitHub. Цифры и так приходят каждое утро в 9:30' });
    const r = await fetch(`https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${env.GH_WORKFLOW}/dispatches`, {
      method: 'POST', headers: { authorization: 'Bearer ' + env.GH_TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'life-city' }, body: JSON.stringify({ ref: 'main' })
    });
    return r.ok ? json({ ok: true }) : err('GitHub не запустил робота: ' + r.status, 502);
  }

  if (p === '/jobs/review' && m === 'POST') { const b = await req.json() as { kind: 'day' | 'week' }; return json({ id: await runReview(env, b.kind === 'week' ? 'week' : 'day', Date.now(), false) }); }
  if (p === '/jobs/briefing' && m === 'POST') return json(await runBriefing(env, Date.now(), false));
  if (p === '/jobs/reminders' && m === 'POST') return json({ sent: await runReminders(env) });
  void ctx;
  return err('not found', 404);
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => route(req, env, ctx).catch(e => err('Ошибка сервера: ' + (e as Error).message, 500)),
  scheduled: (ev: ScheduledController, env: Env, ctx: ExecutionContext) => { ctx.waitUntil(scheduled(ev.cron, env, ev.scheduledTime)); }
} satisfies ExportedHandler<Env>;
