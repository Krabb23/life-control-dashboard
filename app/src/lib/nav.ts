export type Route = 'city' | 'day' | 'calendar' | 'work' | 'habits' | 'goals' | 'bank' | 'brain' | 'library' | 'observatory' | 'settings';
export const ROUTES: Route[] = ['city', 'day', 'calendar', 'work', 'habits', 'goals', 'bank', 'brain', 'library', 'observatory', 'settings'];
export const BUILDING_ROUTE: Record<string, Route> = {
  hall: 'day', agency: 'work', clock: 'calendar', monument: 'goals', arena: 'habits', bank: 'bank',
  brain: 'brain', library: 'library', observatory: 'observatory'
};
export const go = (r: Route) => { location.hash = '/' + r; };
export type AddKind = 'menu' | 'task' | 'event' | 'reminder' | 'expense' | 'income' | 'note' | 'lib' | 'file' | 'project' | 'goal' | 'habit';
export const openAdd = (k: AddKind) => dispatchEvent(new CustomEvent('open-add', { detail: k }));
