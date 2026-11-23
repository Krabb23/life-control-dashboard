import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, save, remove, uid, alive, type Task, type CalEvent, type Reminder, type Txn, type Project, type Goal, type Habit, type Account, type BuildingKind, type Repeat } from '../db';
import { Field, Seg, Sheet, toast } from '../components/ui';
import { addDays, monthKey, pad, today, ymd } from '../lib/dates';
import type { AddKind } from '../lib/nav';
import { go } from '../lib/nav';

export const EXPENSE_CATS = ['Еда', 'Кафе', 'Транспорт', 'Дом и аренда', 'Связь и подписки', 'Реклама клиентов', 'Здоровье', 'Спорт', 'Одежда', 'Подарки', 'Обучение', 'Развлечения', 'Другое'];
export const INCOME_CATS = ['Клиенты', 'Зарплата', 'Возврат', 'Другое'];

const MENU: [AddKind, string, string][] = [
  ['task', 'Задача', 'дело на день или по проекту'],
  ['event', 'Созвон или блок', 'в календарь с напоминанием'],
  ['reminder', 'Напоминание', 'пуш в нужное время'],
  ['expense', 'Расход', 'наличка или карта'],
  ['income', 'Доход', 'оплата клиента и другое'],
  ['note', 'Заметка', 'во Второй мозг'],
  ['file', 'Документ или PDF', 'договор, аренда, скан'],
  ['lib', 'Книга, статья, видео', 'в Библиотеку']
];

export function AddSheet({ kind, onClose }: { kind: AddKind; onClose: () => void }) {
  const [k, setK] = useState<AddKind>(kind);
  return (
    <Sheet onClose={onClose}>
      {k === 'menu' && <>
        <h3>Что добавить</h3>
        <div className="grid2">
          {MENU.map(([id, t, sub]) => (
            <button key={id} className="card click" style={{ textAlign: 'left', gap: 2, padding: '12px 14px' }} onClick={() => setK(id)}>
              <b style={{ fontSize: 15 }}>{t}</b><span className="src">{sub}</span>
            </button>
          ))}
        </div>
      </>}
      {k === 'task' && <TaskForm onDone={onClose} />}
      {k === 'event' && <EventForm onDone={onClose} />}
      {k === 'reminder' && <ReminderForm onDone={onClose} />}
      {(k === 'expense' || k === 'income') && <TxnForm income={k === 'income'} onDone={onClose} />}
      {k === 'project' && <ProjectForm onDone={onClose} />}
      {k === 'goal' && <GoalForm onDone={onClose} />}
      {k === 'habit' && <HabitForm onDone={onClose} />}
      {(k === 'note' || k === 'file') && <Redirect to="brain" what={k} onClose={onClose} />}
      {k === 'lib' && <Redirect to="library" what="lib" onClose={onClose} />}
    </Sheet>
  );
}

// Заметки, файлы и материалы библиотеки добавляются на экранах своих зданий: там же их обработка.
function Redirect({ to, what, onClose }: { to: 'brain' | 'library'; what: string; onClose: () => void }) {
  setTimeout(() => { onClose(); go(to); setTimeout(() => dispatchEvent(new CustomEvent('add-in-building', { detail: what })), 50); }, 0);
  return null;
}

const Actions = ({ onDelete, label = 'Сохранить', disabled }: { onDelete?: () => void; label?: string; disabled?: boolean }) => (
  <div className={onDelete ? 'btns' : ''}>
    {onDelete && <button type="button" className="btn danger" onClick={onDelete}>Удалить</button>}
    <button className="btn main" type="submit" disabled={disabled}>{label}</button>
  </div>
);

// ---------- задача ----------
const SPHERES: [BuildingKind, string][] = [['agency', 'Работа'], ['hall', 'Личное'], ['monument', 'Цели'], ['bank', 'Деньги'], ['arena', 'Здоровье']];
export function TaskForm({ row, onDone, preset }: { row?: Task; onDone: () => void; preset?: Partial<Task> }) {
  const projects = alive(useLiveQuery(() => db.projects.toArray()) || []);
  const [title, setTitle] = useState(row?.title || preset?.title || '');
  const [building, setB] = useState<BuildingKind>(row?.building || preset?.building || 'agency');
  const [projectId, setP] = useState(row?.projectId || preset?.projectId || '');
  const [due, setDue] = useState(row?.due ?? preset?.due ?? today());
  const [main, setMain] = useState(row ? row.mainDate === today() : false);
  const [note, setNote] = useState(row?.note || '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await save('tasks', {
      id: row?.id || uid(), title: title.trim(), building, projectId: building === 'agency' ? projectId || undefined : undefined,
      due: due || undefined, done: row?.done || 0, doneAt: row?.doneAt, note: note || undefined,
      mainDate: main ? today() : row?.mainDate === today() ? undefined : row?.mainDate
    });
    toast(row ? 'Задача обновлена' : 'Задача добавлена');
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{row ? 'Задача' : 'Новая задача'}</h3>
      <input className="in" autoFocus placeholder="Что сделать" value={title} onChange={e => setTitle(e.target.value)} />
      <Seg value={building} options={SPHERES} onChange={setB} />
      {building === 'agency' && projects.length > 0 && (
        <select className="in" value={projectId} onChange={e => setP(e.target.value)}>
          <option value="">Без проекта</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <Seg value={due === today() ? 't' : due === addDays(today(), 1) ? 'tm' : due ? 'd' : 'n'}
        options={[['t', 'Сегодня'], ['tm', 'Завтра'], ['d', 'Дата'], ['n', 'Без срока']]}
        onChange={v => setDue(v === 't' ? today() : v === 'tm' ? addDays(today(), 1) : v === 'd' ? addDays(today(), 2) : '')} />
      {due && due !== today() && due !== addDays(today(), 1) && <input className="in" type="date" value={due} onChange={e => setDue(e.target.value)} />}
      <label className="row" style={{ cursor: 'pointer' }}><span>В 3 главных дела на сегодня</span><input type="checkbox" checked={main} onChange={e => setMain(e.target.checked)} style={{ width: 22, height: 22 }} /></label>
      <textarea className="in" placeholder="Заметка" value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 60 }} />
      <Actions onDelete={row ? async () => { await remove('tasks', row.id); onDone(); } : undefined} />
    </form>
  );
}

// ---------- событие ----------
const REMIND: [number, string][] = [[1440, 'за день'], [60, 'за час'], [15, 'за 15 мин'], [5, 'за 5 мин'], [0, 'в момент']];
export function EventForm({ row, onDone, day }: { row?: CalEvent; onDone: () => void; day?: string }) {
  const s0 = row ? new Date(row.start) : (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; })();
  const dur0 = row ? Math.round((new Date(row.end).getTime() - s0.getTime()) / 60000) : 60;
  const [title, setTitle] = useState(row?.title || '');
  const [kind, setKind] = useState<CalEvent['kind']>(row?.kind || 'call');
  const [date, setDate] = useState(row ? ymd(s0) : day || ymd(s0));
  const [time, setTime] = useState(`${pad(s0.getHours())}:${pad(s0.getMinutes())}`);
  const [dur, setDur] = useState(String(dur0));
  const [link, setLink] = useState(row?.link || '');
  const [remind, setRemind] = useState<number[]>(row?.remind || [15]);
  const [repeat, setRepeat] = useState<Repeat>(row?.repeat || 'none');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
    const start = new Date(y, m - 1, d, hh, mm);
    const end = new Date(start.getTime() + Number(dur) * 60000);
    await save('events', { id: row?.id || uid(), title: title.trim(), kind, start: start.toISOString(), end: end.toISOString(), link: link || undefined, remind, repeat });
    toast(remind.length ? 'В календаре, напомню' : 'В календаре');
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{row ? 'Событие' : 'Новое событие'}</h3>
      <input className="in" autoFocus placeholder="Название" value={title} onChange={e => setTitle(e.target.value)} />
      <Seg value={kind} options={[['call', 'Созвон'], ['block', 'Блок времени'], ['deadline', 'Дедлайн']]} onChange={setKind} />
      <div className="grid2">
        <Field label="День"><input className="in" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Время"><input className="in" type="time" value={time} onChange={e => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Длительность"><Seg value={dur} options={[['15', '15 мин'], ['30', '30 мин'], ['60', '1 час'], ['90', '1,5 часа'], ['120', '2 часа']]} onChange={setDur} /></Field>
      {kind === 'call' && <input className="in" placeholder="Ссылка на встречу" value={link} onChange={e => setLink(e.target.value)} />}
      <Field label="Напомнить">
        <div className="seg">{REMIND.map(([v, l]) => (
          <button type="button" key={v} className={remind.includes(v) ? 'on' : ''} onClick={() => setRemind(remind.includes(v) ? remind.filter(x => x !== v) : [...remind, v])}>{l}</button>
        ))}</div>
      </Field>
      <Field label="Повтор"><Seg value={repeat} options={[['none', 'Нет'], ['daily', 'Каждый день'], ['weekdays', 'По будням'], ['weekly', 'Раз в неделю'], ['monthly', 'Раз в месяц']]} onChange={setRepeat} /></Field>
      <Actions onDelete={row ? async () => { await remove('events', row.id); onDone(); } : undefined} />
    </form>
  );
}

export function ReminderForm({ row, onDone }: { row?: Reminder; onDone: () => void }) {
  const a0 = row ? new Date(row.at) : (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; })();
  const [title, setTitle] = useState(row?.title || '');
  const [date, setDate] = useState(ymd(a0));
  const [time, setTime] = useState(`${pad(a0.getHours())}:${pad(a0.getMinutes())}`);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
    await save('reminders', { id: row?.id || uid(), title: title.trim(), at: new Date(y, m - 1, d, hh, mm).toISOString(), done: row?.done || 0 });
    toast('Напомню');
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>Напоминание</h3>
      <input className="in" autoFocus placeholder="О чём напомнить" value={title} onChange={e => setTitle(e.target.value)} />
      <div className="grid2">
        <input className="in" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input className="in" type="time" value={time} onChange={e => setTime(e.target.value)} />
      </div>
      <Actions onDelete={row ? async () => { await remove('reminders', row.id); onDone(); } : undefined} />
    </form>
  );
}

// ---------- деньги ----------
export function TxnForm({ row, income: inc0, onDone }: { row?: Txn; income?: boolean; onDone: () => void }) {
  const projects = alive(useLiveQuery(() => db.projects.toArray()) || []);
  const [income, setIncome] = useState(row ? row.amount > 0 : !!inc0);
  const [amount, setAmount] = useState(row ? String(Math.abs(row.amount)) : '');
  const [account, setAccount] = useState<Account>(row?.account || 'cash');
  const [category, setCat] = useState(row?.category || (inc0 ? 'Клиенты' : 'Еда'));
  const [date, setDate] = useState(row?.date || today());
  const [note, setNote] = useState(row?.note || '');
  const [projectId, setP] = useState(row?.projectId || '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(/\s/g, '').replace(',', '.'));
    if (!n) return;
    await save('txns', {
      id: row?.id || uid(), date, amount: income ? Math.abs(n) : -Math.abs(n), account, category, note, source: row?.source || 'manual',
      hash: row?.hash, projectId: projectId || undefined, transfer: row?.transfer
    });
    toast(income ? 'Доход записан' : 'Расход записан');
    onDone();
  };
  const cats = income ? INCOME_CATS : EXPENSE_CATS;
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{income ? 'Доход' : 'Расход'}</h3>
      <Seg value={income ? 'i' : 'e'} options={[['e', 'Расход'], ['i', 'Доход']]} onChange={v => { setIncome(v === 'i'); setCat(v === 'i' ? 'Клиенты' : 'Еда'); }} />
      <input className="in" autoFocus inputMode="decimal" placeholder="Сумма, ₸" value={amount} onChange={e => setAmount(e.target.value)} style={{ fontSize: 24, fontFamily: 'var(--display)' }} />
      <Seg value={account} options={[['cash', 'Наличка'], ['kaspi', 'Kaspi'], ['freedom', 'Freedom']]} onChange={setAccount} />
      <div className="seg">{cats.map(c => <button type="button" key={c} className={c === category ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      {income && category === 'Клиенты' && projects.length > 0 && (
        <select className="in" value={projectId} onChange={e => setP(e.target.value)}>
          <option value="">Проект не указан</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <div className="grid2">
        <input className="in" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input className="in" placeholder="Комментарий" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <Actions onDelete={row ? async () => { await remove('txns', row.id); onDone(); } : undefined} />
    </form>
  );
}

// ---------- проект ----------
export function ProjectForm({ row, onDone }: { row?: Project; onDone: () => void }) {
  const [name, setName] = useState(row?.name || '');
  const [acc, setAcc] = useState(row?.adAccountId || '');
  const [cpl, setCpl] = useState(row ? String(row.cplTarget) : '');
  const [budget, setBudget] = useState(row?.dailyBudget ? String(row.dailyBudget) : '');
  const [actions, setActions] = useState(row?.leadActions || 'lead,onsite_conversion.messaging_conversation_started_7d');
  const [active, setActive] = useState(row ? row.active === 1 : true);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const a = acc.trim().replace(/^act_/, '');
    await save('projects', { id: row?.id || uid(), name: name.trim(), adAccountId: a ? 'act_' + a : '', cplTarget: Number(cpl) || 0, dailyBudget: Number(budget) || undefined, leadActions: actions.trim(), active: active ? 1 : 0 });
    toast('Проект сохранён');
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{row ? 'Проект' : 'Новый проект'}</h3>
      <Field label="Название"><input className="in" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Клиника «Дента»" /></Field>
      <Field label="ID рекламного кабинета"><input className="in" value={acc} onChange={e => setAcc(e.target.value)} placeholder="act_1234567890" /></Field>
      <div className="grid2">
        <Field label="Цель по CPL, ₸"><input className="in" inputMode="numeric" value={cpl} onChange={e => setCpl(e.target.value)} /></Field>
        <Field label="Бюджет в день, ₸"><input className="in" inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value)} /></Field>
      </div>
      <Field label="Что считать заявкой (события Meta через запятую)"><input className="in" value={actions} onChange={e => setActions(e.target.value)} style={{ fontSize: 13 }} /></Field>
      <label className="row" style={{ cursor: 'pointer' }}><span>Проект активен</span><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: 22, height: 22 }} /></label>
      <Actions onDelete={row ? async () => { await remove('projects', row.id); onDone(); } : undefined} />
    </form>
  );
}

// ---------- цель ----------
export function GoalForm({ row, onDone }: { row?: Goal; onDone: () => void }) {
  const [title, setTitle] = useState(row?.title || '');
  const [kind, setKind] = useState<Goal['kind']>(row?.kind || 'month');
  const [target, setTarget] = useState(row ? String(row.target) : '');
  const [current, setCurrent] = useState(row ? String(row.current) : '0');
  const [unit, setUnit] = useState(row?.unit || '');
  const [deadline, setDeadline] = useState(row?.deadline || '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !Number(target)) return;
    const cur = Number(current) || 0;
    await save('goals', { id: row?.id || uid(), title: title.trim(), kind, month: kind === 'month' ? row?.month || monthKey() : undefined, target: Number(target), current: cur, unit, deadline: deadline || undefined, valueAt: row && row.current === cur ? row.valueAt : Date.now() });
    toast('Цель сохранена');
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{row ? 'Цель' : 'Новая цель'}</h3>
      <Seg value={kind} options={[['month', 'Босс месяца'], ['long', 'Большая цель']]} onChange={setKind} />
      <input className="in" autoFocus placeholder={kind === 'month' ? '4 новых клиента' : 'Переезд в Астану'} value={title} onChange={e => setTitle(e.target.value)} />
      <div className="grid2">
        <Field label="Сейчас"><input className="in" inputMode="decimal" value={current} onChange={e => setCurrent(e.target.value)} /></Field>
        <Field label="Цель"><input className="in" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Единица"><input className="in" placeholder="клиентов, %, кг" value={unit} onChange={e => setUnit(e.target.value)} /></Field>
        <Field label="Срок"><input className="in" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field>
      </div>
      <Actions onDelete={row ? async () => { await remove('goals', row.id); onDone(); } : undefined} />
    </form>
  );
}

export function HabitForm({ row, onDone }: { row?: Habit; onDone: () => void }) {
  const [name, setName] = useState(row?.name || '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const n = await db.habits.count();
    await save('habits', { id: row?.id || uid(), name: name.trim(), order: row?.order ?? n, active: 1 });
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{row ? 'Привычка' : 'Новая привычка'}</h3>
      <input className="in" autoFocus placeholder="Зал или 8 000 шагов" value={name} onChange={e => setName(e.target.value)} />
      <Actions onDelete={row ? async () => { await remove('habits', row.id); onDone(); } : undefined} />
    </form>
  );
}
