import { useEffect, useMemo, useState } from 'react';
import { save, remove, type Habit } from '../db';
import { Hero, Row, Sheet, useSnapshot, toast, Check } from '../components/ui';
import { computeCity } from '../lib/game';
import { addDays, today } from '../lib/dates';
import { HabitForm } from './Add';
import { go } from '../lib/nav';

function Ten({ v, c, onPick }: { v?: number; c: string; onPick: (n: number) => void }) {
  return (
    <div className="dots10">
      {Array.from({ length: 10 }, (_, i) => (
        <button key={i} type="button" className={v && i < v ? 'on' : ''} style={v && i < v ? { background: c, borderColor: c } : undefined}
          onClick={() => onPick(i + 1)} aria-label={String(i + 1)}>{i + 1}</button>
      ))}
    </div>
  );
}

export function Habits() {
  const s = useSnapshot();
  const t = today();
  const [edit, setEdit] = useState<Habit | 'new' | null>(null);
  const ck0 = s?.checkins.find(c => c.date === t);
  const [sleep, setSleep] = useState<string>('');
  const [energy, setEnergy] = useState<number | undefined>();
  const [stress, setStress] = useState<number | undefined>();
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (ck0) { setSleep(ck0.sleep ? String(ck0.sleep) : ''); setEnergy(ck0.energy); setStress(ck0.stress); setWeight(ck0.weight ? String(ck0.weight) : ''); setNote(ck0.note || ''); }
  }, [ck0?.id]);
  const st = useMemo(() => (s ? computeCity(s).find(b => b.kind === 'arena')! : null), [s]);
  if (!s || !st) return <div className="scr" />;

  const habits = s.habits.filter(h => h.active).sort((a, b) => a.order - b.order);
  const has = (h: string, d: string) => s.habitLogs.some(l => l.habitId === h && l.date === d);
  const toggle = async (h: Habit) => {
    const id = h.id + ':' + t;
    if (has(h.id, t)) await remove('habitLogs', id);
    else await save('habitLogs', { id, habitId: h.id, date: t });
  };
  // серия: дней подряд, когда отмечены все привычки
  let streak = 0;
  if (habits.length) for (let d = has(habits[0].id, t) && habits.every(h => has(h.id, t)) ? t : addDays(t, -1); habits.every(h => has(h.id, d)); d = addDays(d, -1)) streak++;
  const doneToday = habits.filter(h => has(h.id, t)).length;
  const reward = doneToday * 10 + (energy ? 15 : 0);

  const close = async () => {
    await save('checkins', { id: t, date: t, sleep: Number(sleep.replace(',', '.')) || undefined, energy, stress, weight: Number(weight.replace(',', '.')) || undefined, note: note || undefined });
    // вес из чек-ина двигает цель по весу, если она есть
    const w = Number(weight.replace(',', '.'));
    if (w) for (const g of s.goals.filter(g => /вес/i.test(g.title))) await save('goals', { ...g, current: w, valueAt: Date.now() });
    toast(`День закрыт, +${reward} опыта Арене`);
  };

  return (
    <div className="scr">
      <Hero kind="arena" decay={st.decay} name="Арена" level={st.level} xp={st.xp} prev={st.prev} next={st.next}
        status={st.decay ? 'в упадке' : streak ? `серия ${streak} дн.` : 'дисциплина'} statusColor={st.decay ? 'var(--bad)' : 'var(--ok)'} onBack={() => go('city')} />
      {st.decay && <div className="card alert"><b style={{ color: 'var(--bad)' }}>{st.reason}</b><span className="src">Отметь привычку или сделай чек-ин, и Арена вернёт цвет.</span></div>}
      {habits.length === 0 && <div className="card"><div className="empty">Привычек пока нет. Добавь 3-5 главных, например «Подъём до 7:00» или «Зал или 8 000 шагов».</div></div>}
      {habits.map(h => (
        <div className="card" key={h.id} style={{ padding: '12px 14px' }}>
          <div className="habit">
            <Check on={has(h.id, t)} onClick={() => toggle(h)} label={h.name} />
            <span className="nm" onClick={() => setEdit(h)} style={{ cursor: 'pointer' }}>{h.name}</span>
            <div className="days" aria-label="последние 5 дней">{[4, 3, 2, 1, 0].map(i => <i key={i} className={has(h.id, addDays(t, -i)) ? 'on' : ''} />)}</div>
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => setEdit('new')}>+ Привычка</button>
      <div className="card sunk">
        <h3>Вечерний чек-ин</h3>
        <Row k="Сон, часов" v={<input className="in" inputMode="decimal" value={sleep} onChange={e => setSleep(e.target.value)} style={{ width: 90, padding: '6px 10px', textAlign: 'right' }} placeholder="7.5" />} />
        <Row k="Энергия" v={energy ? `${energy} из 10` : '-'} />
        <Ten v={energy} c="var(--energy)" onPick={setEnergy} />
        <div className="scale"><span>1 - разбит</span><span>10 - полон сил</span></div>
        <Row k="Стресс" v={stress ? `${stress} из 10` : '-'} />
        <Ten v={stress} c="var(--warn)" onPick={setStress} />
        <div className="scale"><span>1 - спокойно</span><span>10 - на пределе</span></div>
        <Row k="Вес, кг (если взвешивался)" v={<input className="in" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} style={{ width: 90, padding: '6px 10px', textAlign: 'right' }} />} />
        <textarea className="in" placeholder="Как прошёл день, одной строкой" value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 56 }} />
        <Row k="Награда за день" v={`+${reward} опыта`} vc="var(--warn)" />
      </div>
      <button className="btn main" onClick={close}>{ck0 ? 'Обновить чек-ин' : 'Закрыть день'}</button>
      {edit && <Sheet onClose={() => setEdit(null)}><HabitForm row={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} /></Sheet>}
    </div>
  );
}
