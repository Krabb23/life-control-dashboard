import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, save, alive, type Task, type CalEvent, type Reminder } from '../db';
import { Chip, Head, Pill, Sheet, TaskRow, useSnapshot, toast } from '../components/ui';
import { computeFire, yesterday } from '../lib/fire';
import { addDays, cap, hm, human, money, occursOn, onDay, today, weekday, num } from '../lib/dates';
import { EventForm, ReminderForm, TaskForm } from './Add';
import { openAdd, go } from '../lib/nav';

export function Day({ mode }: { mode: 'paper' | 'schedule' }) {
  return mode === 'paper' ? <Paper /> : <Schedule />;
}

const projName = (s: { projects: { id: string; name: string }[] }, id?: string) => s.projects.find(p => p.id === id)?.name;

function Paper() {
  const s = useSnapshot();
  const t = today();
  const brief = useLiveQuery(() => db.briefings.where('date').equals(t).first(), [t]);
  const [edit, setEdit] = useState<Task | null>(null);
  const fire = useMemo(() => (s ? computeFire(s) : []), [s]);
  if (!s) return <div className="scr" />;
  const y = yesterday(s);
  const main = s.tasks.filter(x => x.mainDate === t);
  // Предложение трёх главных: просроченные и сегодняшние, сначала работа
  const pool = s.tasks.filter(x => !x.done && !x.mainDate && (!x.due || x.due <= t))
    .sort((a, b) => (a.due || '9') .localeCompare(b.due || '9') || (a.building === 'agency' ? -1 : 1));
  const suggest = main.length >= 3 ? [] : pool.slice(0, 3 - main.length);
  const rest = s.tasks.filter(x => !x.mainDate && x.due === t && !suggest.includes(x));
  const started = brief?.started === 1;
  const toggle = (x: Task) => save('tasks', { ...x, done: x.done ? 0 : 1, doneAt: x.done ? undefined : Date.now() });

  const start = async () => {
    for (const x of suggest) await save('tasks', { ...x, mainDate: t });
    await save('briefings', brief ? { ...brief, started: 1 } : { id: 'b-' + t, date: t, text: '', fire: fire.map(f => f.text), ads: [], started: 1 });
    toast('День начат, +20 опыта Ратуше');
  };

  return (
    <div className="scr">
      <Head eyebrow={`${cap(weekday(t)).slice(0, 2)}, ${human(t)} · брифинг 10:00`} title="Газета дня"
        right={<button className="chip" onClick={() => go('calendar')} style={{ cursor: 'pointer' }}>Расписание ›</button>} />
      {brief?.text && <div className="card"><div className="ans">{brief.text}</div><span className="src">Собрано в {brief.updatedAt ? new Date(brief.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '10:00'}</span></div>}
      {fire.length > 0 && (
        <div className="card alert">
          <div className="row"><h3 style={{ color: 'var(--bad)' }}>Горит</h3><Pill t={fire.length} c="var(--bad)" /></div>
          {fire.map((f, i) => (
            <div className="task" key={i}><span style={{ flex: '0 0 10px', height: 10, borderRadius: '50%', background: f.level === 'bad' ? 'var(--bad)' : 'var(--warn)', marginTop: 6 }} />
              <div><b>{f.text}</b><small>{f.src}</small></div></div>
          ))}
        </div>
      )}
      <div className="card">
        <div className="row"><h3>3 главных дела</h3>{!started && suggest.length > 0 && <span className="src">предложение</span>}</div>
        {[...main, ...(started ? [] : suggest)].map(x => (
          <TaskRow key={x.id} title={x.title} on={!!x.done} onToggle={() => toggle(x)} onOpen={() => setEdit(x)}
            meta={[projName(s, x.projectId), x.due && x.due < t ? 'просрочено' : null].filter(Boolean).join(' · ') || undefined} />
        ))}
        {main.length + suggest.length === 0 && <div className="empty">Задач на сегодня нет. Нажми «+», чтобы добавить.</div>}
      </div>
      <div>
        <div className="eyebrow" style={{ margin: '2px 0 8px' }}>Вчера</div>
        <div className="stats">
          <div className="stat"><span className="n">{y.hasAds ? num(y.leads) : '-'}</span><span className="l">{y.hasAds ? `лидов${y.cpl ? ', CPL ' + money(y.cpl) : ''}` : 'нет цифр рекламы'}</span></div>
          <div className="stat"><span className="n">{y.total ? `${y.done} / ${y.total}` : '-'}</span><span className="l">дел закрыто</span></div>
          <div className="stat"><span className="n">{y.ck?.sleep ? `${y.ck.sleep} ч` : '-'}</span><span className="l">{y.ck ? `сон, энергия ${y.ck.energy ?? '-'} из 10` : 'чек-ина не было'}</span></div>
        </div>
      </div>
      {!started ? <button className="btn main" onClick={start}>Начать день</button> : <div className="src" style={{ textAlign: 'center' }}>День начат. Хорошего дня.</div>}
      {rest.length > 0 && (
        <div className="card"><h3>Ещё на сегодня</h3>
          {rest.map(x => <TaskRow key={x.id} title={x.title} on={!!x.done} onToggle={() => toggle(x)} onOpen={() => setEdit(x)} meta={projName(s, x.projectId)} />)}
        </div>
      )}
      <Inbox tasks={s.tasks.filter(x => !x.done && (!x.due || x.due > t) && !x.mainDate)} onOpen={setEdit} onToggle={toggle} />
      {edit && <Sheet onClose={() => setEdit(null)}><TaskForm row={edit} onDone={() => setEdit(null)} /></Sheet>}
    </div>
  );
}

function Inbox({ tasks, onOpen, onToggle }: { tasks: Task[]; onOpen: (t: Task) => void; onToggle: (t: Task) => void }) {
  if (!tasks.length) return null;
  const sorted = [...tasks].sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  return (
    <div className="card"><h3>Впереди и без срока</h3>
      {sorted.slice(0, 20).map(x => <TaskRow key={x.id} title={x.title} on={false} onToggle={() => onToggle(x)} onOpen={() => onOpen(x)} meta={x.due ? human(x.due) : 'без срока'} />)}
    </div>
  );
}

// ---------- Часовая башня: расписание дня ----------
function Schedule() {
  const [day, setDay] = useState(today());
  const events = alive(useLiveQuery(() => db.events.toArray()) || []);
  const rem = alive(useLiveQuery(() => db.reminders.toArray()) || []);
  const tasks = alive(useLiveQuery(() => db.tasks.where('due').equals(day).toArray(), [day]) || []);
  const [edit, setEdit] = useState<CalEvent | Reminder | 'new' | null>(null);
  const items = events.filter(e => occursOn(e, day)).map(e => ({ e, at: onDay(e.start, day) })).sort((a, b) => a.at.getTime() - b.at.getTime());
  const rems = rem.filter(r => r.at.slice(0, 10) === day || new Date(r.at).toDateString() === new Date(day + 'T12:00').toDateString());
  const now = Date.now();
  const nextIdx = day === today() ? items.findIndex(x => x.at.getTime() + (new Date(x.e.end).getTime() - new Date(x.e.start).getTime()) > now) : -1;
  const calls = items.filter(x => x.e.kind === 'call').length;
  const color = (k: string) => (k === 'call' ? 'var(--primary)' : k === 'deadline' ? 'var(--bad)' : 'var(--energy)');
  return (
    <div className="scr">
      <Head eyebrow={`${human(day)} · Часовая башня`} title={cap(weekday(day))} right={<Chip t={`${calls} ${calls === 1 ? 'созвон' : calls > 1 && calls < 5 ? 'созвона' : 'созвонов'}`} c="var(--primary)" />} />
      <div className="seg">
        <button onClick={() => setDay(addDays(day, -1))}>‹ Назад</button>
        <button className={day === today() ? 'on' : ''} onClick={() => setDay(today())}>Сегодня</button>
        <button onClick={() => setDay(addDays(day, 1))}>Вперёд ›</button>
        <input type="date" className="in" style={{ width: 'auto', padding: '6px 10px', fontSize: 14 }} value={day} onChange={e => e.target.value && setDay(e.target.value)} />
        <button onClick={() => go('day')}>Газета</button>
      </div>
      {items.length === 0 && rems.length === 0 && <div className="empty">На этот день ничего нет.</div>}
      {items.map(({ e, at }, i) => {
        const mins = Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000);
        const until = Math.round((at.getTime() - now) / 60000);
        const meta = [
          e.kind === 'call' ? 'созвон' : e.kind === 'deadline' ? 'дедлайн' : `${mins} мин`,
          i === nextIdx && until > 0 && until < 180 ? `через ${until} мин` : null,
          e.remind.length ? 'с напоминанием' : null,
          e.repeat !== 'none' ? 'повторяется' : null
        ].filter(Boolean).join(' · ');
        return (
          <div className="tl" key={e.id + i}>
            <span className="t">{hm(at.toISOString())}</span>
            <div className={'blk' + (i === nextIdx ? ' now' : '')} style={{ ['--c' as string]: color(e.kind), cursor: 'pointer' }} onClick={() => setEdit(e)}>
              <b>{e.title}</b><small>{meta}</small>
              {e.link && <a href={e.link} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} className="link" style={{ display: 'inline-block', marginTop: 4 }}>Открыть встречу</a>}
            </div>
          </div>
        );
      })}
      {rems.map(r => (
        <div className="tl" key={r.id}><span className="t">{hm(r.at)}</span>
          <div className="blk" style={{ ['--c' as string]: 'var(--coin)', cursor: 'pointer' }} onClick={() => setEdit(r)}><b>{r.title}</b><small>напоминание</small></div></div>
      ))}
      {tasks.length > 0 && <div className="card"><h3>Дела на день</h3>{tasks.map(x => <TaskRow key={x.id} title={x.title} on={!!x.done} onToggle={() => save('tasks', { ...x, done: x.done ? 0 : 1, doneAt: x.done ? undefined : Date.now() })} />)}</div>}
      <div className="btns">
        <button className="btn" onClick={() => setEdit('new')}>+ Созвон или блок</button>
        <button className="btn" onClick={() => openAdd('reminder')}>+ Напоминание</button>
      </div>
      {edit && <Sheet onClose={() => setEdit(null)}>
        {edit === 'new' ? <EventForm day={day} onDone={() => setEdit(null)} /> : 'kind' in edit ? <EventForm row={edit} onDone={() => setEdit(null)} /> : <ReminderForm row={edit} onDone={() => setEdit(null)} />}
      </Sheet>}
    </div>
  );
}
