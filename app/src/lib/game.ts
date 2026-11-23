import type { AdStat, Briefing, BuildingKind, CalEvent, Checkin, Doc, Goal, Habit, HabitLog, LibItem, Project, Review, Task, Txn } from '../db';
import { addDays, daysBetween, monthKey, plural, ymd } from './dates';

export interface Snapshot {
  tasks: Task[]; events: CalEvent[]; habits: Habit[]; habitLogs: HabitLog[]; checkins: Checkin[];
  goals: Goal[]; projects: Project[]; adStats: AdStat[]; txns: Txn[]; docs: Doc[]; lib: LibItem[];
  reviews: Review[]; briefings: Briefing[];
}

export interface BuildingState {
  kind: BuildingKind; name: string; xp: number; level: number; next: number; prev: number;
  decay: boolean; reason?: string;
}

export const NAMES: Record<BuildingKind, string> = {
  hall: 'Ратуша', agency: 'Агентство', clock: 'Часовая башня', monument: 'Монумент', arena: 'Арена',
  bank: 'Казна', brain: 'Второй мозг', library: 'Библиотека', observatory: 'Обсерватория'
};
export const SHORT: Record<BuildingKind, string> = {
  hall: 'Ратуша', agency: 'Агентство', clock: 'Часы', monument: 'Монумент', arena: 'Арена',
  bank: 'Казна', brain: 'Мозг', library: 'Библиотека', observatory: 'Обсерватория'
};

// Опыт для уровней 1..5. Уровень никогда не падает: опыт только копится.
const LEVELS = [0, 100, 250, 500, 900];
export function levelOf(xp: number) {
  let l = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) l = i + 1;
  const prev = LEVELS[l - 1], next = l < LEVELS.length ? LEVELS[l] : LEVELS[LEVELS.length - 1];
  return { level: l, prev, next };
}

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, -i - 1)); // вчера, позавчера...

export function computeCity(s: Snapshot, now = new Date()): BuildingState[] {
  const t = ymd(now);
  const out: BuildingState[] = [];
  const mk = (kind: BuildingKind, xp: number, reason?: string) => {
    const l = levelOf(xp);
    out.push({ kind, name: NAMES[kind], xp, ...l, decay: !!reason, reason });
  };

  // Ратуша: план дня. Упадок, если 3 прошлых дня подряд без плана.
  {
    const planned = new Set<string>([...s.briefings.filter(b => b.started).map(b => b.date), ...s.tasks.filter(x => x.mainDate).map(x => x.mainDate!)]);
    const xp = s.briefings.filter(b => b.started).length * 20 + s.tasks.filter(x => x.mainDate).length * 5;
    const hadAny = planned.size > 0;
    const miss = days(t, 3).every(d => !planned.has(d));
    mk('hall', xp, hadAny && miss ? '3 дня подряд без плана дня' : undefined);
  }
  // Агентство: задачи по работе и цифры рекламы.
  {
    const work = s.tasks.filter(x => x.building === 'agency');
    const xp = work.filter(x => x.done).length * 20;
    let reason: string | undefined;
    for (const p of s.projects.filter(p => p.active)) {
      const st = s.adStats.filter(a => a.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
      if (st.length === 2 && st.every(a => a.cpl != null && a.cpl > p.cplTarget)) { reason = `${p.name}: CPL выше цели 2 дня подряд`; break; }
    }
    if (!reason) {
      const late = work.filter(x => !x.done && x.due && x.due < t);
      if (late.length) reason = `${late.length} ${plural(late.length, ['задача просрочена', 'задачи просрочены', 'задач просрочено'])}`;
    }
    mk('agency', xp, reason);
  }
  // Часовая башня: расписание. Упадок, если 3 прошлых дня без единого события.
  {
    const evDays = new Set(s.events.map(e => ymd(new Date(e.start))));
    const repeating = s.events.some(e => e.repeat !== 'none');
    const xp = s.events.length * 8;
    const miss = s.events.length > 0 && !repeating && days(t, 3).every(d => !evDays.has(d));
    mk('clock', xp, miss ? '3 дня без расписания' : undefined);
  }
  // Монумент: цели. Упадок, если цель месяца не двигалась 7 дней.
  {
    const xp = s.goals.reduce((a, g) => a + (g.current > 0 ? 30 : 0), 0) + s.goals.filter(g => g.current >= g.target).length * 100;
    const boss = s.goals.find(g => g.kind === 'month' && g.month === monthKey(now));
    const stale = boss && boss.current < boss.target && boss.valueAt && daysBetween(ymd(new Date(boss.valueAt)), t) >= 7;
    mk('monument', xp, stale ? 'неделя без шага по цели месяца' : undefined);
  }
  // Арена: привычки и чек-ин.
  {
    const xp = s.habitLogs.length * 10 + s.checkins.length * 15;
    let reason: string | undefined;
    const [d1, d2, d3] = days(t, 3);
    for (const h of s.habits.filter(h => h.active)) {
      const created = ymd(new Date(h.updatedAt));
      if (created > d2) continue; // новая привычка, пропусков ещё нет
      const has = (d: string) => s.habitLogs.some(l => l.habitId === h.id && l.date === d);
      if (!has(d1) && !has(d2)) { reason = `«${h.name}»: 2 пропуска подряд`; break; }
    }
    if (!reason && s.checkins.length && ![d1, d2, d3].some(d => s.checkins.some(c => c.date === d))) reason = '3 вечера без чек-ина';
    mk('arena', xp, reason);
  }
  // Казна: учёт денег. Упадок, если 7 дней не было ни одной записи.
  {
    const xp = s.txns.length * 3;
    const last = s.txns.map(x => x.date).sort().pop();
    mk('bank', xp, last && daysBetween(last, t) >= 7 ? `${daysBetween(last, t)} дней без записей и выписки` : undefined);
  }
  // Второй мозг: архив, не серееет.
  mk('brain', s.docs.length * 15);
  // Библиотека: 30 дней без нового материала.
  {
    const xp = s.lib.length * 15 + s.lib.filter(x => x.status === 'done').length * 25;
    const last = Math.max(0, ...s.lib.map(x => x.addedAt));
    mk('library', xp, last && daysBetween(ymd(new Date(last)), t) >= 30 ? '30 дней без нового материала' : undefined);
  }
  // Обсерватория: 3 непрочитанных разбора подряд.
  {
    const xp = s.reviews.filter(r => r.read).length * 10;
    const last3 = [...s.reviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    mk('observatory', xp, last3.length === 3 && last3.every(r => !r.read) ? '3 разбора подряд не открыты' : undefined);
  }
  return out;
}

export const coinsOf = (b: BuildingState[]) => Math.round(b.reduce((a, x) => a + x.xp, 0) / 2);
export const cityLevel = (b: BuildingState[]) => b.reduce((a, x) => a + x.level, 0) - b.length + 1;
