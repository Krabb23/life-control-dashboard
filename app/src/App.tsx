import { useEffect, useState, lazy, Suspense, type ReactElement } from 'react';
import { Toaster } from './components/ui';
import { City } from './screens/City';
import { Day } from './screens/Day';
import { Work } from './screens/Work';
import { Habits } from './screens/Habits';
import { Goals } from './screens/Goals';
import { Bank } from './screens/Bank';
import { Observatory } from './screens/Observatory';
import { Settings } from './screens/Settings';
import { AddSheet } from './screens/Add';
import { ROUTES, go, type Route, type AddKind } from './lib/nav';
import { startSync } from './lib/sync';

// Тяжёлые экраны (PDF, поиск) грузим по требованию
const Brain = lazy(() => import('./screens/Brain').then(m => ({ default: m.Brain })));
const Library = lazy(() => import('./screens/Library').then(m => ({ default: m.Library })));

const readRoute = (): Route => {
  const r = location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(r) ? r : 'city';
};

const IC: Record<string, ReactElement> = {
  city: <path d="M4 20V10l5-4 5 4v10M14 20v-7h6v7M3 20h18" />,
  day: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  work: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M4 12h16" /></>,
  habits: <><path d="M5 13l4 4L19 7" /><path d="M5 5h4M5 9h2" /></>
};
const TAB_OF: Partial<Record<Route, string>> = { city: 'city', goals: 'city', bank: 'city', brain: 'city', library: 'city', observatory: 'city', settings: 'city', day: 'day', calendar: 'day', work: 'work', habits: 'habits' };

export function App() {
  const [route, setRoute] = useState<Route>(readRoute());
  const [add, setAdd] = useState<AddKind | null>(null);
  useEffect(() => {
    const f = () => setRoute(readRoute());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  useEffect(() => { startSync(); }, []);
  // Быстрое добавление из шорткатов и других экранов: #/city?add=task
  useEffect(() => {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const a = q.get('add') as AddKind | null;
    if (a) setAdd(a);
  }, [route]);
  useEffect(() => {
    const f = (e: Event) => setAdd((e as CustomEvent).detail as AddKind);
    addEventListener('open-add', f);
    return () => removeEventListener('open-add', f);
  }, []);

  const tab = TAB_OF[route];
  const screen = {
    city: <City />, day: <Day mode="paper" />, calendar: <Day mode="schedule" />, work: <Work />, habits: <Habits />,
    goals: <Goals />, bank: <Bank />, brain: <Brain />, library: <Library />, observatory: <Observatory />, settings: <Settings />
  }[route];

  return (
    <div className={'app' + (route === 'city' ? ' sky' : '')}>
      <Suspense fallback={<div className="scr"><div className="empty">Загружаю…</div></div>}>{screen}</Suspense>
      <div className="tabbar">
        <nav>
          <Tab id="city" label="Город" on={tab === 'city'} />
          <Tab id="day" label="День" on={tab === 'day'} />
          <button className="tab" onClick={() => setAdd('menu')} aria-label="Добавить"><span className="plus">+</span>Добавить</button>
          <Tab id="work" label="Работа" on={tab === 'work'} />
          <Tab id="habits" label="Привычки" on={tab === 'habits'} />
        </nav>
      </div>
      {add && <AddSheet kind={add} onClose={() => { setAdd(null); if (location.hash.includes('?')) location.hash = location.hash.split('?')[0]; }} />}
      <Toaster />
    </div>
  );
}

function Tab({ id, label, on }: { id: Route; label: string; on: boolean }) {
  return (
    <button className={'tab' + (on ? ' on' : '')} onClick={() => go(id)} aria-current={on ? 'page' : undefined}>
      <svg viewBox="0 0 24 24">{IC[id]}</svg>{label}
    </button>
  );
}

