// Утренний брифинг: что горит, реклама за вчера, день по часам. Общая логика для сервера.
import { tg, almatyDay } from './review';

export interface BData {
  tasks: { title: string; done: 0 | 1; due?: string; mainDate?: string; building: string; projectId?: string }[];
  projects: { id: string; name: string; cplTarget: number; active: 0 | 1 }[];
  adStats: { projectId: string; date: string; spend: number; leads: number; cpl: number | null; rejected?: number; activeCampaigns?: number }[];
  docs: { title: string; fields?: { endDate?: string } }[];
  goals: { title: string; kind: string; month?: string; current: number; target: number }[];
  events: { title: string; start: string; end: string; kind: string; repeat: string }[];
  checkins: { date: string; sleep?: number; energy?: number; stress?: number }[];
  habits: { id: string; name: string; active: 0 | 1 }[];
  txns: { date: string; amount: number; transfer?: 0 | 1 }[];
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const prevDay = (s: string) => new Date(Date.parse(s) - 86400000).toISOString().slice(0, 10);

// Время события в день `day` по местному времени (offsetMin), для повторяющихся тоже
export function occurrence(ev: { start: string; repeat: string }, day: string, offsetMin: number): number | null {
  const s = Date.parse(ev.start);
  const local = new Date(s + offsetMin * 60000);
  const sDay = local.toISOString().slice(0, 10);
  if (day < sDay) return null;
  const d = new Date(day + 'T00:00:00Z');
  const ok = day === sDay || ev.repeat === 'daily' || (ev.repeat === 'weekdays' && d.getUTCDay() >= 1 && d.getUTCDay() <= 5)
    || (ev.repeat === 'weekly' && d.getUTCDay() === local.getUTCDay()) || (ev.repeat === 'monthly' && d.getUTCDate() === local.getUTCDate());
  if (!ok) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), local.getUTCHours(), local.getUTCMinutes()) - offsetMin * 60000;
}

export function briefing(d: BData, nowMs: number, offsetMin = 300) {
  const t = almatyDay(nowMs, offsetMin), y = prevDay(t);
  const fire: string[] = [];
  const ads: { project: string; spend: number; leads: number; cpl: number | null; target: number }[] = [];
  for (const p of d.projects.filter(p => p.active)) {
    const st = d.adStats.filter(a => a.projectId === p.id && a.date === y)[0];
    if (!st) continue;
    ads.push({ project: p.name, spend: st.spend, leads: st.leads, cpl: st.cpl, target: p.cplTarget });
    if (st.cpl != null && p.cplTarget && st.cpl > p.cplTarget) fire.push(`${p.name}: CPL ${tg(st.cpl)} при цели ${tg(p.cplTarget)}`);
    if (st.rejected) fire.push(`${p.name}: отклонено объявлений ${st.rejected}`);
    if ((st.activeCampaigns || 0) > 0 && st.spend === 0) fire.push(`${p.name}: кампании активны, а расхода нет`);
  }
  const late = d.tasks.filter(x => !x.done && x.due && x.due < t);
  if (late.length) fire.push(`Просрочено задач: ${late.length} (${late.slice(0, 2).map(x => x.title).join(', ')})`);
  for (const doc of d.docs) {
    const e = doc.fields?.endDate;
    if (e && /^\d{4}-\d{2}-\d{2}$/.test(e)) { const left = dayDiff(t, e); if (left >= 0 && left <= 30) fire.push(`${doc.title}: срок заканчивается через ${left} дн.`); }
  }
  const mk = t.slice(0, 7);
  const boss = d.goals.find(g => g.kind === 'month' && g.month === mk);
  const schedule = d.events.map(e => ({ e, at: occurrence(e, t, offsetMin) })).filter(x => x.at != null).sort((a, b) => a.at! - b.at!)
    .map(x => `${new Date(x.at! + offsetMin * 60000).toISOString().slice(11, 16)} ${x.e.title}`);
  const tasksToday = d.tasks.filter(x => !x.done && (x.mainDate === t || x.due === t || (x.due && x.due < t)));
  const ck = d.checkins.find(c => c.date === y);
  const spentY = -d.txns.filter(x => x.date === y && x.amount < 0 && !x.transfer).reduce((a, x) => a + x.amount, 0);
  const facts = [
    `Дата: ${t}.`,
    'Горит: ' + (fire.join('; ') || 'ничего'),
    'Сегодня по часам: ' + (schedule.join('; ') || 'событий нет'),
    'Дела: ' + (tasksToday.map(x => x.title).join('; ') || 'не запланированы'),
    'Реклама за вчера: ' + (ads.map(a => `${a.project}: ${tg(a.spend)}, ${a.leads} лидов, CPL ${a.cpl != null ? tg(a.cpl) : '-'} (цель ${tg(a.target)})`).join('; ') || 'нет данных'),
    `Вчера: сон ${ck?.sleep ?? '-'} ч, энергия ${ck?.energy ?? '-'}, стресс ${ck?.stress ?? '-'}, расходы ${tg(spentY)}.`,
    boss ? `Цель месяца: ${boss.title}, ${boss.current} из ${boss.target}.` : 'Цели месяца нет.'
  ].join('\n');
  const template = [
    fire.length ? `Горит: ${fire[0]}.` : 'Ничего не горит.',
    schedule.length ? `Сегодня ${schedule.length} событий, первое в ${schedule[0]}.` : 'Календарь свободен.',
    tasksToday.length ? `Главное: ${tasksToday.slice(0, 3).map(x => x.title).join(', ')}.` : 'Выбери 3 главных дела.'
  ].join(' ');
  return { date: t, fire, ads, facts, template, headline: fire[0] || (schedule[0] ? 'Первое: ' + schedule[0] : 'Выбери 3 главных дела') };
}
