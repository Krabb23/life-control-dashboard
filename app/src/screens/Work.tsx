import { useMemo, useState } from 'react';
import { save, type Project, type Task } from '../db';
import { Hero, Pill, Row, Sheet, TaskRow, useSnapshot, toast } from '../components/ui';
import { computeCity } from '../lib/game';
import { addDays, human, money, monthKey, num, today } from '../lib/dates';
import { ProjectForm, TaskForm } from './Add';
import { adsRefresh, ApiError } from '../lib/api';
import { syncNow } from '../lib/sync';
import { go } from '../lib/nav';

export function Work() {
  const s = useSnapshot();
  const [edit, setEdit] = useState<{ p?: Project | 'new'; t?: Task | 'new' } | null>(null);
  const [busy, setBusy] = useState(false);
  const st = useMemo(() => (s ? computeCity(s).find(b => b.kind === 'agency')! : null), [s]);
  if (!s || !st) return <div className="scr" />;
  const t = today(), from7 = addDays(t, -7), mk = monthKey();

  const cards = s.projects.filter(p => p.active).map(p => {
    const stats = s.adStats.filter(a => a.projectId === p.id);
    const last = [...stats].sort((a, b) => b.date.localeCompare(a.date))[0];
    const w = stats.filter(a => a.date >= from7 && a.date < t);
    const spend = w.reduce((a, x) => a + x.spend, 0), leads = w.reduce((a, x) => a + x.leads, 0);
    const cpl7 = leads ? spend / leads : null;
    const bad = !!(last && last.cpl != null && p.cplTarget && last.cpl > p.cplTarget) || !!last?.rejected;
    const income = s.txns.filter(x => x.projectId === p.id && x.amount > 0 && x.date.startsWith(mk)).reduce((a, x) => a + x.amount, 0);
    return { p, last, spend, leads, cpl7, bad, income, tasks: s.tasks.filter(x => x.projectId === p.id && !x.done) };
  }).sort((a, b) => Number(b.bad) - Number(a.bad));

  const work = s.tasks.filter(x => x.building === 'agency' && !x.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const lastAt = Math.max(0, ...s.adStats.map(a => a.updatedAt));
  const refresh = async () => {
    setBusy(true);
    try { const r = await adsRefresh(); toast(r.note || 'Запросил свежие цифры, придут через 1-2 минуты'); setTimeout(() => syncNow(), 90_000); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); }
    finally { setBusy(false); }
  };
  const toggle = (x: Task) => save('tasks', { ...x, done: x.done ? 0 : 1, doneAt: x.done ? undefined : Date.now() });

  return (
    <div className="scr">
      <Hero kind="agency" decay={st.decay} name="Агентство" level={st.level} xp={st.xp} prev={st.prev} next={st.next}
        status={st.decay ? 'в упадке' : `${cards.length} проектов`} statusColor={st.decay ? 'var(--bad)' : 'var(--ok)'} onBack={() => go('city')} />
      {st.decay && <div className="card alert"><b style={{ color: 'var(--bad)' }}>{st.reason}</b></div>}
      <div className="row"><span className="src">{lastAt ? `Цифры рекламы обновлены ${new Date(lastAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Цифры рекламы ещё не приходили'}</span>
        <button className="btn sm" onClick={refresh} disabled={busy}>{busy ? '…' : 'Обновить сейчас'}</button></div>
      {cards.length === 0 && <div className="card"><div className="empty">Добавь проекты: название, ID рекламного кабинета и цель по CPL. Каждое утро в 9:30 цифры будут приходить сами.</div></div>}
      {cards.map(({ p, last, spend, leads, cpl7, bad, income, tasks }) => (
        <div key={p.id} className={'card click' + (bad ? ' alert' : '')} onClick={() => setEdit({ p })}>
          <div className="row"><b style={{ fontSize: 16 }}>{p.name}</b>
            {last ? <Pill t={bad ? (last.rejected ? 'отклонены объявления' : 'CPL выше цели') : 'в норме'} c={bad ? 'var(--bad)' : 'var(--ok)'} /> : <Pill t="нет данных" c="var(--muted)" />}</div>
          {last && <Row k={`Вчера (${human(last.date)})`} v={`${money(last.spend)} · ${last.leads} лид. · ${last.cpl != null ? money(last.cpl) : '-'}`} vc={bad ? 'var(--bad)' : undefined} />}
          <Row k="7 дней: расход" v={money(spend)} />
          <Row k="Лиды · CPL" v={`${num(leads)} · ${cpl7 != null ? money(cpl7) : '-'}`} />
          {p.cplTarget > 0 && <Row k="Цель по CPL" v={money(p.cplTarget)} />}
          {income > 0 && <Row k="Оплаты в этом месяце" v={money(income)} vc="var(--ok)" />}
          {tasks.length > 0 && <span className="src">Задач по проекту: {tasks.length}</span>}
          {!p.adAccountId && <span className="src">Кабинет не указан, цифры не придут</span>}
        </div>
      ))}
      <div className="btns"><button className="btn" onClick={() => setEdit({ p: 'new' })}>+ Проект</button><button className="btn" onClick={() => setEdit({ t: 'new' })}>+ Задача</button></div>
      <div className="card">
        <div className="row"><h3>Задачи по работе</h3><span className="v" style={{ color: 'var(--muted)' }}>{work.length}</span></div>
        {work.length === 0 && <div className="empty">Открытых задач нет</div>}
        {work.map(x => <TaskRow key={x.id} title={x.title} on={false} onToggle={() => toggle(x)} onOpen={() => setEdit({ t: x })}
          meta={[s.projects.find(p => p.id === x.projectId)?.name, x.due ? (x.due < t ? 'просрочено' : human(x.due)) : null, '+20 опыта'].filter(Boolean).join(' · ')} />)}
      </div>
      {edit && <Sheet onClose={() => setEdit(null)}>
        {edit.p && <ProjectForm row={edit.p === 'new' ? undefined : edit.p} onDone={() => setEdit(null)} />}
        {edit.t && <TaskForm row={edit.t === 'new' ? undefined : edit.t} preset={{ building: 'agency' }} onDone={() => setEdit(null)} />}
      </Sheet>}
    </div>
  );
}
