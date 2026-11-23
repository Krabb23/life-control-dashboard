import { useEffect, useMemo, useState } from 'react';
import { save, uid, type Review } from '../db';
import { Hero, Seg, useSnapshot, toast } from '../components/ui';
import { computeCity } from '../lib/game';
import { addDays, human, mondayOf, today } from '../lib/dates';
import { review, range, bestWorst } from '../../../shared/review';
import { api, serverCfg, ApiError } from '../lib/api';
import { syncNow } from '../lib/sync';
import { go } from '../lib/nav';

export function Observatory() {
  const s = useSnapshot();
  const [kind, setKind] = useState<'day' | 'week'>('day');
  const [busy, setBusy] = useState(false);
  const st = useMemo(() => (s ? computeCity(s).find(b => b.kind === 'observatory')! : null), [s]);
  const list = s ? [...s.reviews].filter(r => r.kind === kind).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const cur = list[0];
  useEffect(() => { if (cur && !cur.read) save('reviews', { ...cur, read: 1 }); }, [cur?.id]);
  if (!s || !st) return <div className="scr" />;

  // Разбор прямо сейчас: на сервере с ИИ, без сервера по шаблону на устройстве
  const runNow = async () => {
    setBusy(true);
    try {
      if (await serverCfg()) {
        await syncNow();
        await api('/jobs/review', { kind });
        await syncNow();
        toast('Разбор готов');
        return;
      }
    } catch (e) { if (!(e instanceof ApiError) || e.code !== 'noserver') toast((e as Error).message + '. Собрал по шаблону'); }
    finally { setBusy(false); }
    const t = today();
    const days = kind === 'day' ? [t] : range(mondayOf(t), 7).filter(d => d <= t);
    const r = review(s as never, days, -new Date().getTimezoneOffset());
    const bw = kind === 'week' ? bestWorst(s as never, days, -new Date().getTimezoneOffset()) : null;
    const stats = { ...r.stats, ...(bw ? { 'лучший день': human(bw.best), 'худший день': human(bw.worst) } : {}) };
    await save('reviews', { id: kind + '-' + (kind === 'day' ? t : days[0]) || uid(), kind, date: kind === 'day' ? t : days[0], good: r.good.join('\n'), bad: r.bad.join('\n'), next: r.next.join('\n'), stats, read: 1 });
  };

  const st3 = cur?.stats ? Object.entries(cur.stats).slice(0, 3) : [];
  return (
    <div className="scr">
      <Hero kind="observatory" decay={st.decay} name="Обсерватория" level={st.level} xp={st.xp} prev={st.prev} next={st.next}
        status={kind === 'day' ? 'разбор дня' : 'итоги недели'} statusColor="var(--primary)" onBack={() => go('city')} />
      <Seg value={kind} options={[['day', 'День'], ['week', 'Неделя']]} onChange={setKind} />
      {!cur && <div className="card"><div className="empty">{kind === 'day' ? 'Разбор дня приходит вечером после чек-ина или в 22:00.' : 'Итоги недели приходят в воскресенье в 20:00.'}</div></div>}
      {cur && <ReviewView r={cur} stats={st3} />}
      <button className="btn" disabled={busy} onClick={runNow}>{busy ? 'Собираю…' : kind === 'day' ? 'Разобрать сегодня сейчас' : 'Подвести итоги недели сейчас'}</button>
      {list.slice(1, 8).map(r => (
        <details key={r.id} className="card"><summary style={{ cursor: 'pointer', fontWeight: 800 }}>{kind === 'day' ? human(r.date) : `Неделя с ${human(r.date)} по ${human(addDays(r.date, 6))}`}</summary><ReviewView r={r} stats={[]} /></details>
      ))}
    </div>
  );
}

function ReviewView({ r, stats }: { r: Review; stats: [string, string | number][] }) {
  const lines = (s: string) => s.split('\n').filter(Boolean);
  return (
    <>
      <div className="eyebrow">{r.kind === 'day' ? human(r.date) : `Неделя ${human(r.date)} - ${human(addDays(r.date, 6))}`}</div>
      {stats.length > 0 && <div className="stats">{stats.map(([k, v]) => <div className="stat" key={k}><span className="n">{v}</span><span className="l">{k}</span></div>)}</div>}
      {r.good && <div className="card"><h3 style={{ color: 'var(--ok)' }}>Получилось</h3><div className="ans">{lines(r.good).join('\n')}</div></div>}
      {r.bad && <div className="card"><h3 style={{ color: 'var(--bad)' }}>Не получилось</h3><div className="ans">{lines(r.bad).join('\n')}</div></div>}
      {r.next && <div className="card boss"><h3>{r.kind === 'day' ? 'На завтра' : `${lines(r.next).length} ${lines(r.next).length === 1 ? 'вывод' : 'вывода'} на неделю`}</h3><div className="ans">{lines(r.next).map((x, i) => `${i + 1}. ${x}`).join('\n')}</div></div>}
      {r.stats && Object.keys(r.stats).length > 3 && <div className="src">{Object.entries(r.stats).slice(3).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>}
    </>
  );
}
