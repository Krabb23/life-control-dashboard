import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, alive } from '../db';
import type { Snapshot } from '../lib/game';
import { svgHero } from '../scene/draw';

export const Bar = ({ p, c = 'var(--ok)' }: { p: number; c?: string }) => (
  <div className="bar"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`, background: c }} /></div>
);
export const NoData = () => (
  <div className="bar" style={{ background: 'repeating-linear-gradient(45deg,var(--sunken) 0 6px,var(--surface) 6px 12px)' }} />
);
export const Chip = ({ t, c = 'var(--coin)' }: { t: ReactNode; c?: string }) => (
  <span className="chip"><i style={{ background: c }} />{t}</span>
);
export const Pill = ({ t, c }: { t: ReactNode; c: string }) => <span className="pill" style={{ color: c }}>{t}</span>;
export const Row = ({ k, v, vc }: { k: ReactNode; v: ReactNode; vc?: string }) => (
  <div className="row"><span className="k">{k}</span><span className="v" style={vc ? { color: vc } : undefined}>{v}</span></div>
);
export const Head = ({ eyebrow, title, right }: { eyebrow: ReactNode; title: ReactNode; right?: ReactNode }) => (
  <div className="head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{right}</div>
);

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={'ck' + (on ? ' on' : '')} onClick={e => { e.stopPropagation(); onClick(); }} aria-label={label} aria-pressed={on} />;
}

export function TaskRow({ title, meta, on, onToggle, onOpen }: { title: string; meta?: ReactNode; on: boolean; onToggle: () => void; onOpen?: () => void }) {
  return (
    <div className="task" onClick={onOpen} style={onOpen ? { cursor: 'pointer' } : undefined}>
      <Check on={on} onClick={onToggle} label={title} />
      <div><b style={on ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{title}</b>{meta && <small>{meta}</small>}</div>
    </div>
  );
}

export function Hero({ kind, decay, name, level, xp, prev, next, status, statusColor, onBack }: {
  kind: string; decay: boolean; name: string; level: number; xp: number; prev: number; next: number;
  status: ReactNode; statusColor: string; onBack: () => void;
}) {
  const max = level >= 5;
  return (
    <div className="hero">
      <div className="top"><button onClick={onBack}>‹ Город</button><Pill t={status} c={statusColor} /></div>
      <div dangerouslySetInnerHTML={{ __html: svgHero(kind, decay) }} style={{ display: 'flex', justifyContent: 'center' }} />
      <h2>{name}</h2>
      <Row k={`Уровень ${level}`} v={max ? 'максимум' : `${xp} / ${next} опыта`} />
      <Bar p={max ? 1 : (xp - prev) / (next - prev)} c="var(--coin)" />
    </div>
  );
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog"><div className="grab" />{children}</div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map(([v, l]) => <button key={v} type="button" className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

// Тосты
let pushToast: (t: string) => void = () => {};
export const toast = (t: string) => pushToast(t);
export function Toaster() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    pushToast = (x: string) => { setT(x); clearTimeout(timer); timer = window.setTimeout(() => setT(null), 2600); };
  }, []);
  return t ? <div className="toast" role="status">{t}</div> : null;
}

// Весь срез данных для экранов города. Данных у одного человека немного, так что читаем таблицы целиком.
export function useSnapshot(): Snapshot | undefined {
  return useLiveQuery(async () => {
    const [tasks, events, habits, habitLogs, checkins, goals, projects, adStats, txns, docs, lib, reviews, briefings] = await Promise.all([
      db.tasks.toArray(), db.events.toArray(), db.habits.toArray(), db.habitLogs.toArray(), db.checkins.toArray(),
      db.goals.toArray(), db.projects.toArray(), db.adStats.toArray(), db.txns.toArray(), db.docs.toArray(),
      db.lib.toArray(), db.reviews.toArray(), db.briefings.toArray()
    ]);
    return {
      tasks: alive(tasks), events: alive(events), habits: alive(habits), habitLogs: alive(habitLogs), checkins: alive(checkins),
      goals: alive(goals), projects: alive(projects), adStats: alive(adStats), txns: alive(txns), docs: alive(docs),
      lib: alive(lib), reviews: alive(reviews), briefings: alive(briefings)
    };
  });
}
