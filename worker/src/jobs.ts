// Задачи по расписанию: напоминания, брифинг 10:00, разбор дня, итоги недели.
import type { Env } from './env';
import { all, get, put, snapshot, getMeta, setMeta } from './store';
import { sendPush, type PushSub } from './webpush';
import { generate, parseJson } from './gemini';
import { briefing, occurrence } from '../../shared/brief';
import { review, bestWorst, range, almatyDay } from '../../shared/review';

const off = (env: Env) => Number(env.TZ_OFFSET_MIN || 300);

export async function pushAll(env: Env, data: { title: string; body: string; url?: string; tag?: string }) {
  const subs = (await env.DB.prepare('SELECT endpoint, data FROM push_subs').all<{ endpoint: string; data: string }>()).results || [];
  const v = { publicKey: env.VAPID_PUBLIC, privateKey: env.VAPID_PRIVATE, subject: env.VAPID_SUBJECT || 'mailto:owner@example.com' };
  let ok = 0;
  for (const s of subs) {
    try {
      const st = await sendPush(JSON.parse(s.data) as PushSub, data, v);
      if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(s.endpoint).run();
      else if (st < 300) ok++;
    } catch { /* одно устройство не должно ломать остальные */ }
  }
  return ok;
}

// Один раз на ключ: защита от двойной отправки
async function once(env: Env, key: string) {
  const r = await env.DB.prepare('INSERT OR IGNORE INTO push_log (key, at) VALUES (?1, ?2)').bind(key, Date.now()).run();
  return (r.meta.changes || 0) > 0;
}

const fmtTime = (ms: number, o: number) => new Date(ms + o * 60000).toISOString().slice(11, 16);
const before = (m: number) => (m === 0 ? 'сейчас' : m >= 1440 ? 'завтра' : m >= 60 ? `через ${m / 60} ч` : `через ${m} мин`);

export async function runReminders(env: Env, now = Date.now()) {
  const last = Number(await getMeta(env, 'remindersAt')) || now - 60_000;
  const from = Math.max(last, now - 10 * 60_000);
  await setMeta(env, 'remindersAt', String(now));
  const o = off(env);
  const events = await all<{ id: string; title: string; start: string; repeat: string; remind: number[]; kind: string; link?: string }>(env, 'events');
  const days = [almatyDay(now, o), almatyDay(now + 86400000, o), almatyDay(now + 2 * 86400000, o)];
  let sent = 0;
  for (const e of events) for (const day of days) {
    const at = occurrence(e, day, o);
    if (at == null) continue;
    for (const m of e.remind || []) {
      const fire = at - m * 60000;
      if (fire > from && fire <= now && (await once(env, `ev:${e.id}:${at}:${m}`))) {
        await pushAll(env, { title: `${e.kind === 'call' ? 'Созвон' : e.kind === 'deadline' ? 'Дедлайн' : 'Блок'} ${before(m)}`, body: `${fmtTime(at, o)} ${e.title}`, url: e.link || './#/calendar', tag: 'ev-' + e.id });
        sent++;
      }
    }
  }
  const rems = await all<{ id: string; title: string; at: string; done: 0 | 1 }>(env, 'reminders');
  for (const r of rems) {
    const at = Date.parse(r.at);
    if (!r.done && at > from && at <= now && (await once(env, `rem:${r.id}:${at}`))) { await pushAll(env, { title: 'Напоминание', body: r.title, url: './#/calendar', tag: 'rem-' + r.id }); sent++; }
  }
  // чистим старый журнал раз в сутки
  if (new Date(now).getUTCMinutes() === 0 && new Date(now).getUTCHours() === 0) await env.DB.prepare('DELETE FROM push_log WHERE at < ?1').bind(now - 7 * 86400000).run();
  return sent;
}

export async function runBriefing(env: Env, now = Date.now(), push = true) {
  const s = await snapshot(env);
  const b = briefing(s, now, off(env));
  let text = b.template;
  if (env.GEMINI_API_KEY) {
    try {
      const r = await generate(env, 'smart', 'Ты личный ассистент Раймбека. Пиши по-русски, на «ты», коротко и по делу, без воды и без приветствий. Числа цифрами. Не выдумывай ничего, чего нет в данных.',
        [{ text: `Собери утренний брифинг на день одним абзацем на 3-5 предложений: что горит и что с этим сделать, главное по расписанию, на что обратить внимание по рекламе и самочувствию. Данные:\n${b.facts}` }]);
      text = r.text;
    } catch { /* остаётся шаблон */ }
  }
  const id = 'b-' + b.date;
  const prev = await get<{ started?: 0 | 1 }>(env, 'briefings', id);
  await put(env, 'briefings', id, { date: b.date, text, fire: b.fire, ads: b.ads, started: prev?.started || 0 });
  if (push) await pushAll(env, { title: 'Брифинг на день готов', body: b.headline, url: './#/day', tag: 'brief' });
  return { date: b.date, text };
}

export async function runReview(env: Env, kind: 'day' | 'week', now = Date.now(), push = true) {
  const o = off(env), t = almatyDay(now, o);
  const s = await snapshot(env);
  let days: string[];
  if (kind === 'day') days = [t];
  else { const wd = (new Date(t + 'T00:00:00Z').getUTCDay() + 6) % 7; days = range(new Date(Date.parse(t) - wd * 86400000).toISOString().slice(0, 10), 7).filter(d => d <= t); }
  const r = review(s, days, o);
  const bw = kind === 'week' ? bestWorst(s, days, o) : null;
  let { good, bad, next } = r;
  if (env.GEMINI_API_KEY) {
    try {
      const g = await generate(env, 'smart', 'Ты личный ассистент Раймбека. Пишешь разбор по-русски, на «ты», прямо и без воды. Числа цифрами. Опирайся только на данные, ничего не выдумывай.',
        [{ text: `Сделай ${kind === 'day' ? 'разбор дня' : 'итоги недели'}. Верни JSON {"good":[строки],"bad":[строки],"next":[ровно ${kind === 'day' ? '1-2' : '3'} конкретных шага]}. Каждая строка до 120 символов.\nФакты что получилось: ${good.join('; ') || 'нет'}\nЧто не получилось: ${bad.join('; ') || 'нет'}\nЧерновик шагов: ${next.join('; ')}\nСводка: ${JSON.stringify(r.stats)}${bw ? `\nЛучший день ${bw.best}, худший ${bw.worst}` : ''}` }],
        { json: true });
      const j = parseJson<{ good?: string[]; bad?: string[]; next?: string[] }>(g.text);
      if (Array.isArray(j.good)) good = j.good; if (Array.isArray(j.bad)) bad = j.bad; if (Array.isArray(j.next) && j.next.length) next = j.next;
    } catch { /* остаётся шаблон */ }
  }
  const stats: Record<string, string | number> = { ...r.stats };
  if (bw) { stats['лучший день'] = bw.best; stats['худший день'] = bw.worst; }
  const id = kind + '-' + days[0];
  await put(env, 'reviews', id, { kind, date: days[0], good: good.join('\n'), bad: bad.join('\n'), next: next.join('\n'), stats, read: 0 });
  if (push) await pushAll(env, { title: kind === 'day' ? 'Разбор дня готов' : 'Итоги недели готовы', body: (good[0] || bad[0] || next[0] || '').slice(0, 120), url: './#/observatory', tag: 'review-' + kind });
  return id;
}

export async function scheduled(cron: string, env: Env, now: number) {
  if (cron === '* * * * *') return runReminders(env, now);
  if (cron === '0 5 * * *') return runBriefing(env, now);
  if (cron === '0 17 * * *') {
    // разбор дня, если вечером его ещё не сделали после чек-ина
    const t = almatyDay(now, off(env));
    if (!(await get(env, 'reviews', 'day-' + t))) return runReview(env, 'day', now);
    return;
  }
  if (cron === '0 15 * * SUN') return runReview(env, 'week', now);
}
