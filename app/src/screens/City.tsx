import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, Chip, Head, useSnapshot } from '../components/ui';
import { computeCity, coinsOf, cityLevel, SHORT } from '../lib/game';
import { cityScene } from '../scene/draw';
import { BUILDING_ROUTE, go } from '../lib/nav';
import { cap, human, occursOn, today, weekday, plural } from '../lib/dates';
import { getLocal } from '../db';

export function City() {
  const s = useSnapshot();
  const syncAt = useLiveQuery(() => getLocal<number>('syncAt', 0));
  const t = today();
  const st = useMemo(() => (s ? computeCity(s) : []), [s]);
  const todayTasks = s ? s.tasks.filter(x => x.due === t || x.mainDate === t || (x.done && x.doneAt && new Date(x.doneAt).toDateString() === new Date().toDateString())) : [];
  const done = todayTasks.filter(x => x.done).length;
  const calls = s ? s.events.filter(e => e.kind === 'call' && occursOn(e, t)).length : 0;
  const energy = s ? [...s.checkins].sort((a, b) => b.date.localeCompare(a.date))[0]?.energy : undefined;
  const svg = useMemo(() => cityScene(st.map(b => ({ kind: b.kind, decay: b.decay, label: `${SHORT[b.kind]} · ${b.level}` })), 3 + done * 2), [st, done]);
  const decayed = st.filter(b => b.decay);

  if (!s) return <div className="scr" />;
  return (
    <div className="scr">
      <div className="hud">
        <Chip t={`Ур. ${cityLevel(st)}`} c="var(--primary)" />
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip t={coinsOf(st).toLocaleString('ru-RU')} />
          <Chip t={energy ? `${energy}/10` : '-/10'} c="var(--energy)" />
          <button className="chip" onClick={() => go('settings')} aria-label="Настройки" style={{ cursor: 'pointer' }}>⚙︎</button>
        </div>
      </div>
      <Head eyebrow={`${cap(weekday(t))}, ${human(t)}`} title="Лайф Сити" />
      <svg className="scene" viewBox="8 40 342 318" role="img" aria-label={`Парящий город из ${st.length} зданий`}
        onClick={e => { const k = (e.target as Element).closest('[data-b]')?.getAttribute('data-b'); if (k) go(BUILDING_ROUTE[k]); }}
        dangerouslySetInnerHTML={{ __html: svg }} />
      {decayed.length > 0 && (
        <div className="card alert" style={{ gap: 8 }}>
          <b style={{ color: 'var(--bad)' }}>{decayed.length === 1 ? 'Почему 1 здание в упадке' : `Почему ${decayed.length} ${plural(decayed.length, ['здание', 'здания', 'зданий'])} в упадке`}</b>
          <div className="src" style={{ fontSize: 13.5, color: 'var(--ink)' }}>
            {decayed.map(b => <div key={b.kind} onClick={() => go(BUILDING_ROUTE[b.kind])} style={{ cursor: 'pointer' }}>{b.name}: {b.reason}.</div>)}
          </div>
          <div className="src">Один пропуск не считается. Уровень зданий не падает, вернёшь цвет одним действием.</div>
        </div>
      )}
      <div className="card click" onClick={() => go('day')}>
        <div className="row"><b style={{ fontSize: 16 }}>Сегодня</b><span className="v" style={{ color: 'var(--muted)' }}>{done} из {todayTasks.length} дел · {calls} {plural(calls, ['созвон', 'созвона', 'созвонов'])}</span></div>
        <Bar p={todayTasks.length ? done / todayTasks.length : 0} c="var(--coin)" />
      </div>
      <div className="grid2">
        {st.filter(b => ['bank', 'monument', 'brain', 'library', 'observatory', 'clock'].includes(b.kind)).map(b => (
          <button key={b.kind} className="btn sm" style={{ width: '100%', color: b.decay ? 'var(--bad)' : undefined }} onClick={() => go(BUILDING_ROUTE[b.kind])}>{b.name}</button>
        ))}
      </div>
      <div className="src" style={{ textAlign: 'center' }}>{syncAt ? `Синхронизировано ${new Date(syncAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Данные хранятся на этом устройстве'}</div>
    </div>
  );
}
