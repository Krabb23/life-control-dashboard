import { db, save, alive, uid, type Chunk } from '../db';
import { aiAsk, aiEmbed, serverCfg, type AiCtx } from './api';
import { addDays, money, monthKey, today } from './dates';

// Режем текст на куски по ~900 символов с нахлёстом, помним страницу.
export function chunkText(pages: string[], size = 900, overlap = 150): { text: string; page: number }[] {
  const out: { text: string; page: number }[] = [];
  pages.forEach((p, pi) => {
    const t = p.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    for (let i = 0; i < t.length; i += size - overlap) {
      const piece = t.slice(i, i + size).trim();
      if (piece.length > 40) out.push({ text: piece, page: pi + 1 });
      if (i + size >= t.length) break;
    }
  });
  return out;
}

// Индексация документа или материала библиотеки: куски + векторы (если сервер подключён).
export async function indexItem(source: Chunk['source'], parentId: string, pages: string[]) {
  const old = await db.chunks.where('parentId').equals(parentId).toArray();
  for (const c of old) await save('chunks', { ...c, deleted: 1 });
  const parts = chunkText(pages);
  let vecs: number[][] = [];
  if (parts.length && (await serverCfg()) && navigator.onLine) {
    try {
      for (let i = 0; i < parts.length; i += 32) vecs.push(...(await aiEmbed(parts.slice(i, i + 32).map(p => p.text))).vectors);
    } catch { vecs = []; }
  }
  for (let i = 0; i < parts.length; i++)
    await save('chunks', { id: uid(), source, parentId, idx: i, page: parts[i].page, text: parts[i].text, vec: vecs[i] });
  return { chunks: parts.length, embedded: vecs.length > 0 };
}

// Досчитать векторы для кусков, которые индексировались без интернета.
export async function embedMissing() {
  if (!(await serverCfg()) || !navigator.onLine) return 0;
  const todo = alive(await db.chunks.toArray()).filter(c => !c.vec).slice(0, 96);
  for (let i = 0; i < todo.length; i += 32) {
    const part = todo.slice(i, i + 32);
    const { vectors } = await aiEmbed(part.map(c => c.text));
    for (let j = 0; j < part.length; j++) await save('chunks', { ...part[j], vec: vectors[j] });
  }
  return todo.length;
}

const cos = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / (Math.sqrt(x * y) || 1); };
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2).map(w => w.slice(0, 6));

export async function searchChunks(q: string, source?: Chunk['source'], k = 8, exclude = new Set<string>()) {
  let all = alive(await db.chunks.toArray()).filter(c => !exclude.has(c.parentId));
  if (source) all = all.filter(c => c.source === source);
  if (!all.length) return [];
  let qv: number[] | null = null;
  if (all.some(c => c.vec) && (await serverCfg()) && navigator.onLine) {
    try { qv = (await aiEmbed([q])).vectors[0]; } catch { qv = null; }
  }
  const qw = new Set(words(q));
  const scored = all.map(c => {
    const cw = words(c.text);
    const kw = qw.size ? cw.filter(w => qw.has(w)).length / Math.sqrt(cw.length + 1) : 0;
    const sv = qv && c.vec ? cos(qv, c.vec) : 0;
    return { c, score: sv * 2 + kw };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k).filter(x => x.score > 0).map(x => x.c);
}

// Короткая сводка «что сейчас происходит» для ИИ: задачи, реклама, деньги, цели.
export async function factsSnapshot() {
  const t = today(), mk = monthKey();
  const tasks = alive(await db.tasks.toArray());
  const projects = alive(await db.projects.toArray());
  const stats = alive(await db.adStats.toArray()).filter(a => a.date >= addDays(t, -7));
  const txns = alive(await db.txns.toArray()).filter(x => x.date.startsWith(mk) && !x.transfer);
  const goals = alive(await db.goals.toArray());
  const events = alive(await db.events.toArray()).filter(e => e.start.slice(0, 10) >= t).slice(0, 10);
  const lines = [
    `Сегодня ${t}.`,
    'Открытые задачи: ' + (tasks.filter(x => !x.done).slice(0, 15).map(x => `${x.title}${x.due ? ' (срок ' + x.due + ')' : ''}`).join('; ') || 'нет'),
    'Ближайшие события: ' + (events.map(e => `${e.start.slice(0, 16).replace('T', ' ')} ${e.title}`).join('; ') || 'нет'),
    'Реклама за 7 дней: ' + (projects.map(p => {
      const w = stats.filter(a => a.projectId === p.id), sp = w.reduce((a, x) => a + x.spend, 0), l = w.reduce((a, x) => a + x.leads, 0);
      return `${p.name}: расход ${money(sp)}, лидов ${l}, CPL ${l ? money(sp / l) : '-'}, цель CPL ${money(p.cplTarget)}`;
    }).join('; ') || 'нет данных'),
    `Деньги за месяц: расходы ${money(-txns.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0))}, доходы ${money(txns.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0))}`,
    'Цели: ' + (goals.map(g => `${g.title}: ${g.current} из ${g.target} ${g.unit}`).join('; ') || 'нет')
  ];
  return lines.join('\n');
}

// Вопрос к ИИ: находим куски, отправляем, сохраняем переписку.
export async function ask(question: string, thread: 'brain' | 'lib') {
  const at = Date.now();
  await save('chat', { id: uid(), role: 'user', text: question, at, thread });
  const docs = alive(await db.docs.toArray()), lib = alive(await db.lib.toArray());
  const exclude = new Set(docs.filter(d => d.noAI).map(d => d.id));
  const hits = await searchChunks(question, thread === 'lib' ? 'lib' : undefined, 8, exclude);
  const titleOf = (c: Chunk) => (c.source === 'doc' ? docs.find(d => d.id === c.parentId)?.title : lib.find(l => l.id === c.parentId)?.title) || 'без названия';
  const ctx: AiCtx[] = hits.map(c => ({ title: titleOf(c), where: c.page ? `стр. ${c.page}` : '', text: c.text }));
  const hist = alive(await db.chat.orderBy('at').reverse().limit(8).toArray()).reverse()
    .filter(m => m.thread === thread && m.at < at).map(m => ({ role: m.role, text: m.text }));
  const facts = thread === 'brain' ? await factsSnapshot() : '';
  const r = await aiAsk(question, ctx, facts, hist);
  const cites = r.used.map(i => ctx[i - 1]).filter(Boolean).map(c => ({ title: c.title, where: c.where }));
  const uniq = cites.filter((c, i) => cites.findIndex(x => x.title === c.title && x.where === c.where) === i);
  await save('chat', { id: uid(), role: 'ai', text: r.text, cites: uniq, at: Date.now(), thread });
  return r;
}
