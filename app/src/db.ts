import Dexie, { type Table } from 'dexie';

// Каждая запись синхронизируемой таблицы несёт id, время правки и флаг удаления.
export interface Base { id: string; updatedAt: number; deleted?: 0 | 1 }

export type BuildingKind =
  | 'hall' | 'agency' | 'clock' | 'monument' | 'arena' | 'bank'
  | 'brain' | 'library' | 'observatory';

export interface Task extends Base {
  title: string;
  building: BuildingKind;
  projectId?: string;
  due?: string;            // YYYY-MM-DD
  done: 0 | 1;
  doneAt?: number;
  mainDate?: string;       // день, на который задача стала одной из 3 главных
  note?: string;
}

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export interface CalEvent extends Base {
  title: string;
  start: string;           // ISO с часовым поясом
  end: string;
  kind: 'call' | 'block' | 'habit' | 'deadline';
  link?: string;
  remind: number[];        // за сколько минут напомнить
  repeat: Repeat;
  note?: string;
}

export interface Reminder extends Base { title: string; at: string; done: 0 | 1 }

export interface Habit extends Base { name: string; order: number; active: 0 | 1 }
export interface HabitLog extends Base { habitId: string; date: string }

export interface Checkin extends Base {
  date: string; sleep?: number; energy?: number; stress?: number; weight?: number; note?: string;
}

export interface Goal extends Base {
  title: string;
  kind: 'month' | 'long';
  month?: string;          // YYYY-MM для цели месяца (босса)
  target: number;
  current: number;
  unit: string;
  deadline?: string;
  valueAt?: number;        // когда последний раз обновляли значение
}

export interface Project extends Base {
  name: string;
  adAccountId: string;     // act_123...
  cplTarget: number;
  dailyBudget?: number;
  leadActions: string;     // через запятую: lead, onsite_conversion.messaging_conversation_started_7d
  active: 0 | 1;
}

export interface AdStat extends Base {
  projectId: string; date: string; spend: number; impressions: number; clicks: number;
  leads: number; cpl: number | null; ctr: number | null; cpm: number | null;
  rejected?: number; activeCampaigns?: number;
}

export type Account = 'kaspi' | 'freedom' | 'cash';
export interface Txn extends Base {
  date: string; amount: number; account: Account; category: string; note: string;
  source: 'manual' | 'import'; hash?: string; projectId?: string; transfer?: 0 | 1;
}
export interface CatRule extends Base { match: string; category: string }

export interface Doc extends Base {
  title: string;
  type: 'contract' | 'lease' | 'note' | 'invoice' | 'other';
  fileId?: string;         // ключ файла в облаке
  fileName?: string;
  mime?: string;
  text: string;
  fields?: { parties?: string; amount?: string; endDate?: string; termination?: string; summary?: string };
  noAI?: 0 | 1;
  indexed?: 0 | 1;
  createdAt: number;
}

export interface LibItem extends Base {
  kind: 'book' | 'article' | 'video';
  title: string;
  url?: string;
  summary?: string;
  ideas?: string[];
  notes?: string;
  text?: string;
  status: 'new' | 'reading' | 'done';
  indexed?: 0 | 1;
  addedAt: number;
}

export interface Chunk extends Base {
  source: 'doc' | 'lib';
  parentId: string;
  idx: number;
  page?: number;
  text: string;
  vec?: number[];
}

export interface Review extends Base {
  kind: 'day' | 'week';
  date: string;            // день, или понедельник недели
  good: string; bad: string; next: string;
  stats?: Record<string, string | number>;
  read?: 0 | 1;
}

export interface Briefing extends Base {
  date: string;
  text: string;            // абзац от ИИ или шаблон
  fire: string[];
  ads: { project: string; spend: number; leads: number; cpl: number | null; target: number }[];
  started?: 0 | 1;
}

export interface ChatMsg extends Base { role: 'user' | 'ai'; text: string; cites?: { title: string; where: string }[]; at: number; thread?: 'brain' | 'lib' }

export interface Setting extends Base { value: unknown }

// Локальные таблицы без синхронизации
export interface FileBlob { id: string; blob: Blob; name: string; mime: string; uploaded: 0 | 1 }
export interface Outbox { key: string; table: string; id: string }
export interface Local { key: string; value: unknown }

export const SYNCED = [
  'tasks', 'events', 'reminders', 'habits', 'habitLogs', 'checkins', 'goals', 'projects', 'adStats',
  'txns', 'catRules', 'docs', 'lib', 'chunks', 'reviews', 'briefings', 'chat', 'settings'
] as const;
export type SyncedTable = typeof SYNCED[number];

class CityDB extends Dexie {
  tasks!: Table<Task, string>;
  events!: Table<CalEvent, string>;
  reminders!: Table<Reminder, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  checkins!: Table<Checkin, string>;
  goals!: Table<Goal, string>;
  projects!: Table<Project, string>;
  adStats!: Table<AdStat, string>;
  txns!: Table<Txn, string>;
  catRules!: Table<CatRule, string>;
  docs!: Table<Doc, string>;
  lib!: Table<LibItem, string>;
  chunks!: Table<Chunk, string>;
  reviews!: Table<Review, string>;
  briefings!: Table<Briefing, string>;
  chat!: Table<ChatMsg, string>;
  settings!: Table<Setting, string>;
  files!: Table<FileBlob, string>;
  outbox!: Table<Outbox, string>;
  local!: Table<Local, string>;

  constructor() {
    super('life-city');
    this.version(1).stores({
      tasks: 'id, updatedAt, due, done, mainDate, projectId, building',
      events: 'id, updatedAt, start',
      reminders: 'id, updatedAt, at',
      habits: 'id, updatedAt, order',
      habitLogs: 'id, updatedAt, habitId, date',
      checkins: 'id, updatedAt, date',
      goals: 'id, updatedAt, kind, month',
      projects: 'id, updatedAt',
      adStats: 'id, updatedAt, projectId, date',
      txns: 'id, updatedAt, date, account, hash',
      catRules: 'id, updatedAt',
      docs: 'id, updatedAt, type',
      lib: 'id, updatedAt, kind',
      chunks: 'id, updatedAt, parentId, source',
      reviews: 'id, updatedAt, kind, date',
      briefings: 'id, updatedAt, date',
      chat: 'id, updatedAt, at',
      settings: 'id, updatedAt',
      files: 'id, uploaded',
      outbox: 'key',
      local: 'key'
    });
  }
}

export const db = new CityDB();

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

interface Rows {
  tasks: Task; events: CalEvent; reminders: Reminder; habits: Habit; habitLogs: HabitLog; checkins: Checkin; goals: Goal;
  projects: Project; adStats: AdStat; txns: Txn; catRules: CatRule; docs: Doc; lib: LibItem; chunks: Chunk; reviews: Review;
  briefings: Briefing; chat: ChatMsg; settings: Setting;
}
type Row<T extends SyncedTable> = Rows[T];

// Все изменения идут через save/remove: проставляют время и кладут запись в очередь синхронизации.
export async function save<T extends SyncedTable>(table: T, row: Omit<Row<T>, 'updatedAt'> & { updatedAt?: number }) {
  const r = { ...row, updatedAt: Date.now() } as Row<T>;
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).put(r);
    await db.outbox.put({ key: table + ':' + r.id, table, id: r.id });
  });
  notifyChange();
  return r;
}

export async function remove(table: SyncedTable, id: string) {
  const cur = await db.table(table).get(id);
  if (!cur) return;
  await save(table, { ...cur, deleted: 1 });
}

// Живые запросы не должны показывать удалённые записи.
export const alive = <T extends Base>(rows: T[]) => rows.filter(r => !r.deleted);

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await db.settings.get(key);
  return r && !r.deleted ? (r.value as T) : fallback;
}
export const setSetting = (key: string, value: unknown) => save('settings', { id: key, value });

export async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const r = await db.local.get(key);
  return r ? (r.value as T) : fallback;
}
export const setLocal = (key: string, value: unknown) => db.local.put({ key, value });

let listeners: (() => void)[] = [];
export const onChange = (f: () => void) => { listeners.push(f); return () => { listeners = listeners.filter(x => x !== f); }; };
function notifyChange() { listeners.forEach(f => f()); }
