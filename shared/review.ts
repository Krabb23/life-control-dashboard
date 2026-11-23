// Общая логика разборов и брифинга: используется и приложением, и сервером.
// Работает на простых объектах, без базы данных.

export interface RData {
  tasks: { title: string; done: 0 | 1; doneAt?: number; due?: string; mainDate?: string; building: string }[];
  habits: { id: string; name: string; active: 0 | 1 }[];
  habitLogs: { habitId: string; date: string }[];
  checkins: { date: string; sleep?: number; energy?: number; stress?: number }[];
  projects: { id: string; name: string; cplTarget: number; active: 0 | 1 }[];
  adStats: { projectId: string; date: string; spend: number; leads: number }[];
  txns: { date: string; amount: number; transfer?: 0 | 1 }[];
  events: { title: string; start: string; kind: string; repeat: string }[];
}

export interface ReviewOut { good: string[]; bad: string[]; next: string[]; stats: Record<string, string | number> }

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const tg = (n: number) => fmt(n) + ' ₸';

function addDays(s: string, n: number) { const [y, m, d] = s.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); }
export function range(from: string, days: number) { return Array.from({ length: days }, (_, i) => addDays(from, i)); }

// Дата по Алматы (UTC+5) для момента времени: нужен серверу, который живёт в UTC.
export const almatyDay = (ms: number, offsetMin = 300) => new Date(ms + offsetMin * 60000).toISOString().slice(0, 10);

function dayTasks(d: RData, day: string, offsetMin: number) {
  return d.tasks.filter(t => t.due === day || t.mainDate === day || (t.doneAt && almatyDay(t.doneAt, offsetMin) === day));
}

export function review(d: RData, days: string[], offsetMin = 300): ReviewOut {
  const good: string[] = [], bad: string[] = [], next: string[] = [];
  const set = new Set(days);
  // задачи
  const tasks = days.flatMap(x => dayTasks(d, x, offsetMin));
  const uniq = [...new Set(tasks)];
  const done = uniq.filter(t => t.done && t.doneAt && set.has(almatyDay(t.doneAt, offsetMin))).length;
  const planned = uniq.length;
  if (planned) {
    const r = done / planned;
    if (r >= 0.7) good.push(`Сделано ${done} из ${planned} дел`);
    else bad.push(`Сделано только ${done} из ${planned} дел`);
  }
  const lastDay = days[days.length - 1];
  const late = d.tasks.filter(t => !t.done && t.due && t.due <= lastDay);
  if (late.length) { bad.push(`Висят просроченные: ${late.slice(0, 3).map(t => t.title).join(', ')}`); next.push(`Закрыть или перенести: ${late[0].title}`); }
  // привычки
  const habits = d.habits.filter(h => h.active);
  if (habits.length) {
    const total = habits.length * days.length;
    const got = d.habitLogs.filter(l => set.has(l.date) && habits.some(h => h.id === l.habitId)).length;
    const pct = Math.round((got / total) * 100);
    const worst = habits.map(h => ({ h, n: d.habitLogs.filter(l => l.habitId === h.id && set.has(l.date)).length })).sort((a, b) => a.n - b.n)[0];
    const best = habits.map(h => ({ h, n: d.habitLogs.filter(l => l.habitId === h.id && set.has(l.date)).length })).sort((a, b) => b.n - a.n)[0];
    if (pct >= 80) good.push(`Привычки: ${pct}%`); else bad.push(`Привычки: ${pct}%`);
    if (best && best.n === days.length && days.length > 1) good.push(`«${best.h.name}» все ${days.length} дней`);
    if (worst && worst.n < days.length * 0.5) { bad.push(`«${worst.h.name}» пропущено ${days.length - worst.n} раз`); next.push(`Сделать «${worst.h.name}» проще или перенести на утро`); }
  }
  // чек-ин
  const cks = d.checkins.filter(c => set.has(c.date));
  if (!cks.length) bad.push(days.length === 1 ? 'Не было вечернего чек-ина' : 'Ни одного чек-ина за неделю');
  else {
    const avg = (k: 'sleep' | 'energy' | 'stress') => { const v = cks.map(c => c[k]).filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const en = avg('energy'), sr = avg('stress'), sl = avg('sleep');
    if (en != null) (en >= 7 ? good : en <= 4 ? bad : good).push(`Энергия ${en.toFixed(1)} из 10`);
    if (sr != null && sr >= 7) { bad.push(`Стресс ${sr.toFixed(1)} из 10`); next.push('Поставить в календарь 1 свободный блок без созвонов'); }
    if (sl != null && sl < 6.5) { bad.push(`Сон в среднем ${sl.toFixed(1)} ч`); next.push('Лечь до 23:30 хотя бы 3 дня'); }
  }
  // реклама
  let spendAll = 0, leadsAll = 0;
  for (const p of d.projects.filter(p => p.active)) {
    const st = d.adStats.filter(a => a.projectId === p.id && set.has(a.date));
    if (!st.length) continue;
    const sp = st.reduce((a, x) => a + x.spend, 0), l = st.reduce((a, x) => a + x.leads, 0);
    spendAll += sp; leadsAll += l;
    const cpl = l ? sp / l : null;
    if (p.cplTarget && cpl != null) {
      if (cpl <= p.cplTarget) good.push(`${p.name}: ${l} лидов по ${tg(cpl)}, дешевле цели`);
      else { bad.push(`${p.name}: CPL ${tg(cpl)} при цели ${tg(p.cplTarget)}`); next.push(`${p.name}: новые креативы или аудитории`); }
    } else if (sp > 0 && l === 0) { bad.push(`${p.name}: расход ${tg(sp)} без заявок`); next.push(`${p.name}: проверить, что считается заявкой`); }
  }
  // деньги
  const tx = d.txns.filter(t => set.has(t.date) && !t.transfer);
  const spent = -tx.filter(t => t.amount < 0).reduce((a, t) => a + t.amount, 0);
  const earned = tx.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  if (earned > 0) good.push(`Доход ${tg(earned)}`);

  if (!next.length) next.push(good.length ? 'Держать темп и не брать больше 3 главных дел в день' : 'Начать день с газеты и выбрать 3 главных дела');
  return {
    good, bad, next: [...new Set(next)].slice(0, 3),
    stats: {
      'дел сделано': planned ? `${done} / ${planned}` : '-',
      'привычек': habits.length ? `${Math.round((d.habitLogs.filter(l => set.has(l.date)).length / (habits.length * days.length)) * 100)}%` : '-',
      'лидов': leadsAll ? fmt(leadsAll) : '-',
      'CPL': leadsAll ? tg(spendAll / leadsAll) : '-',
      'расходы': tg(spent),
      'доходы': tg(earned)
    }
  };
}

// Лучший и худший день недели по доле сделанных дел
export function bestWorst(d: RData, days: string[], offsetMin = 300) {
  const sc = days.map(x => { const t = dayTasks(d, x, offsetMin); return { x, r: t.length ? t.filter(z => z.done).length / t.length : -1 }; }).filter(z => z.r >= 0);
  if (sc.length < 2) return null;
  sc.sort((a, b) => b.r - a.r);
  return { best: sc[0].x, worst: sc[sc.length - 1].x };
}
