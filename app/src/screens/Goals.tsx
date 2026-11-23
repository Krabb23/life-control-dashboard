import { useState } from 'react';
import { save, type Goal } from '../db';
import { Bar, Chip, Head, NoData, Row, Sheet, useSnapshot, toast } from '../components/ui';
import { goalsMap } from '../scene/draw';
import { cap, human, monthKey, monthName, monthGen } from '../lib/dates';
import { GoalForm } from './Add';
import { go } from '../lib/nav';

const shiftMonth = (k: string, n: number) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return monthKey(d); };

export function Goals() {
  const s = useSnapshot();
  const [edit, setEdit] = useState<Goal | 'new' | null>(null);
  if (!s) return <div className="scr" />;
  const cur = monthKey();
  const bosses = s.goals.filter(g => g.kind === 'month');
  const boss = bosses.find(g => g.month === cur);
  const longs = s.goals.filter(g => g.kind === 'long');
  const won = bosses.filter(g => g.current >= g.target && g.month! < cur).length + (boss && boss.current >= boss.target ? 1 : 0);
  // карта: прошлый месяц, текущий, 2 следующих, и первая большая цель
  const nodes = [-1, 0, 1, 2].map(n => {
    const k = shiftMonth(cur, n), g = bosses.find(b => b.month === k);
    return { label: cap(monthName(k)), state: n < 0 ? (g && g.current >= g.target ? 'done' : 'lock') : n === 0 ? (g && g.current >= g.target ? 'done' : 'now') : 'lock' };
  });
  if (longs[0]) nodes.push({ label: longs[0].title.length > 14 ? longs[0].title.slice(0, 13) + '…' : longs[0].title, state: 'lock' });
  const step = async (g: Goal, d: number) => {
    const v = Math.max(0, +(g.current + d).toFixed(2));
    await save('goals', { ...g, current: v, valueAt: Date.now() });
    if (g.kind === 'month' && v >= g.target && g.current < g.target) toast('Босс побеждён! К городу прилетает новый остров');
  };
  const daysLeft = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate() - n.getDate(); })();

  return (
    <div className="scr">
      <Head eyebrow={<button className="link" onClick={() => go('city')}>‹ Город · Монумент</button>} title="Путь к 2033" right={<Chip t={`${won} ${won === 1 ? 'район' : won > 1 && won < 5 ? 'района' : 'районов'}`} />} />
      <svg viewBox="0 0 358 278" width="100%" role="img" aria-label="Карта целей по месяцам" dangerouslySetInnerHTML={{ __html: goalsMap(nodes) }} />
      {boss ? (
        <div className="card boss click" onClick={() => setEdit(boss)}>
          <div className="row"><b style={{ fontSize: 16 }}>Босс {monthGen(cur)}: {boss.title}</b><span className="v">{boss.current} / {boss.target}</span></div>
          <Bar p={boss.current / boss.target} c="var(--coin)" />
          <div className="row">
            <span className="src">{boss.current >= boss.target ? 'Побеждён. Новый остров уже у города.' : `Осталось ${daysLeft} дн. Победишь - к городу прилетит новый остров.`}</span>
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className="btn sm" onClick={() => step(boss, -1)}>−1</button>
              <button className="btn sm main" onClick={() => step(boss, 1)}>+1</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card boss"><b>Босса на {monthName(cur)} нет</b><span className="src">Поставь одну главную цель месяца: например «4 новых клиента».</span>
          <button className="btn main" onClick={() => setEdit('new')}>Поставить цель месяца</button></div>
      )}
      {longs.map(g => (
        <div className="card click" key={g.id} onClick={() => setEdit(g)}>
          <Row k={<b style={{ color: 'var(--ink)', fontSize: 15 }}>{g.title}</b>} v={g.current ? `${g.current} / ${g.target} ${g.unit}` : 'нет данных'} vc={g.current ? undefined : 'var(--muted)'} />
          {g.current ? <Bar p={g.current / g.target} c="var(--energy)" /> : <NoData />}
          <div className="src">{g.current ? `обновлено ${g.valueAt ? human(new Date(g.valueAt).toISOString().slice(0, 10)) : ''}` : 'Пока нет замеров. Обнови значение, и полоса начнёт расти'}{g.deadline ? ` · срок ${human(g.deadline)}` : ''}</div>
        </div>
      ))}
      <button className="btn" onClick={() => setEdit('new')}>+ Цель</button>
      {edit && <Sheet onClose={() => setEdit(null)}><GoalForm row={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} /></Sheet>}
    </div>
  );
}
