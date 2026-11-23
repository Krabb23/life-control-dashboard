// Даты в локальном времени устройства (у Раймбека Алматы, UTC+5).
export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd();
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const monthKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const hm = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON1 = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const weekday = (s: string) => WD[parseYmd(s).getDay()];
export const human = (s: string) => { const d = parseYmd(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
export const monthName = (key: string) => MON1[Number(key.split('-')[1]) - 1];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
export const mondayOf = (s: string) => { const d = parseYmd(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); };

// Склонение: plural(3, ['день','дня','дней'])
export function plural(n: number, f: [string, string, string]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b > 1 && b < 5) return f[1];
  if (b === 1) return f[0];
  return f[2];
}

export const money = (n: number) => {
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + s + ' ₸';
};
export const num = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// Повторы событий календаря: попадает ли событие на день
export function occursOn(ev: { start: string; repeat: string }, day: string) {
  const s = ymd(new Date(ev.start));
  if (day < s) return false;
  if (day === s) return true;
  const d = parseYmd(day), sd = new Date(ev.start);
  switch (ev.repeat) {
    case 'daily': return true;
    case 'weekdays': return d.getDay() >= 1 && d.getDay() <= 5;
    case 'weekly': return d.getDay() === sd.getDay();
    case 'monthly': return d.getDate() === sd.getDate();
    default: return false;
  }
}
// Время начала события в конкретный день (для повторяющихся)
export function onDay(iso: string, day: string) {
  const t = new Date(iso), d = parseYmd(day);
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d;
}
export const monthGen = (key: string) => MON[Number(key.split('-')[1]) - 1];
