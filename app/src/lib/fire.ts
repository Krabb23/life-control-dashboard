import type { Snapshot } from './game';
import { addDays, daysBetween, monthKey, monthName, today, money, parseYmd } from './dates';

export interface Fire { level: 'bad' | 'warn'; text: string; src: string }

// «Горит»: то, что требует внимания сегодня. Считается из данных на устройстве.
export function computeFire(s: Snapshot, now = new Date()): Fire[] {
  const t = today(), out: Fire[] = [];
  for (const p of s.projects.filter(p => p.active)) {
    const last = s.adStats.filter(a => a.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!last) continue;
    if (last.cpl != null && p.cplTarget && last.cpl > p.cplTarget)
      out.push({ level: 'bad', text: `${p.name}: CPL ${money(last.cpl)} при цели ${money(p.cplTarget)}`, src: 'Агентство · из рекламного кабинета' });
    if (last.rejected) out.push({ level: 'bad', text: `${p.name}: отклонено объявлений - ${last.rejected}`, src: 'Агентство · модерация Meta' });
    if ((last.activeCampaigns || 0) > 0 && last.spend === 0) out.push({ level: 'warn', text: `${p.name}: кампании активны, но расход 0`, src: 'Агентство' });
  }
  const late = s.tasks.filter(x => !x.done && x.due && x.due < t);
  if (late.length) out.push({ level: 'warn', text: `Просрочено задач: ${late.length}`, src: late.slice(0, 2).map(x => x.title).join(', ') });
  for (const d of s.docs) {
    const end = d.fields?.endDate;
    if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) continue;
    const left = daysBetween(t, end);
    if (left >= 0 && left <= 30) out.push({ level: left <= 7 ? 'bad' : 'warn', text: `${d.title}: заканчивается через ${left} дн.`, src: 'Второй мозг' });
  }
  const boss = s.goals.find(g => g.kind === 'month' && g.month === monthKey(now));
  if (boss && boss.current < boss.target) {
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pace = now.getDate() / dim;
    if (boss.current / boss.target < pace - 0.15)
      out.push({ level: 'warn', text: `${boss.title}: ${boss.current} из ${boss.target}, до конца ${monthName(monthKey(now))} ${dim - now.getDate()} дн.`, src: 'Монумент · цель месяца' });
  }
  return out;
}

// Сводка за вчера
export function yesterday(s: Snapshot) {
  const y = addDays(today(), -1);
  const ads = s.adStats.filter(a => a.date === y);
  const leads = ads.reduce((a, x) => a + x.leads, 0), spend = ads.reduce((a, x) => a + x.spend, 0);
  const tasks = s.tasks.filter(x => x.due === y || x.mainDate === y || (x.doneAt && x.doneAt >= parseYmd(y).getTime() && x.doneAt < parseYmd(today()).getTime()));
  const ck = s.checkins.find(c => c.date === y);
  return { leads, cpl: leads ? spend / leads : null, hasAds: ads.length > 0, done: tasks.filter(x => x.done).length, total: tasks.length, ck };
}
