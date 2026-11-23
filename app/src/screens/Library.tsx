import { useEffect, useMemo, useState } from 'react';
import { db, save, remove, uid, type LibItem } from '../db';
import { Field, Hero, Seg, Sheet, useSnapshot, toast, TaskRow } from '../components/ui';
import { ChatBox } from '../components/Chat';
import { computeCity } from '../lib/game';
import { human, ymd } from '../lib/dates';
import { indexItem } from '../lib/search';
import { aiExtract, serverCfg, ApiError } from '../lib/api';
import { go } from '../lib/nav';

const KIND: [LibItem['kind'], string][] = [['video', 'Видео'], ['article', 'Статья'], ['book', 'Книга']];
const kindName = (k: LibItem['kind']) => KIND.find(x => x[0] === k)![1];

// Материал из ссылки: сервер скачивает статью или смотрит видео через ИИ и делает конспект.
export async function processItem(id: string) {
  const it = await db.lib.get(id);
  if (!it) return;
  let summary = it.summary, ideas = it.ideas, title = it.title, text = it.text;
  if (it.url && (await serverCfg()) && (it.kind === 'video' || it.kind === 'article')) {
    try {
      const r = await aiExtract(it.kind, { url: it.url, notes: it.notes || '' }) as { title?: string; summary?: string; ideas?: string[]; text?: string };
      summary = r.summary || summary; ideas = r.ideas || ideas; title = it.title || r.title || it.url; text = r.text || text;
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Конспект не получился, сохранил ссылку и заметки'); }
  } else if (!it.url && it.notes && (await serverCfg())) {
    try {
      const r = await aiExtract('library', { title: it.title, notes: it.notes }) as { summary?: string; ideas?: string[] };
      summary = r.summary || summary; ideas = r.ideas || ideas;
    } catch { /* без конспекта */ }
  }
  const body = [title, summary, (ideas || []).map(i => '- ' + i).join('\n'), it.notes, text].filter(Boolean).join('\n\n');
  await save('lib', { ...it, title: title || 'Без названия', summary, ideas, text, indexed: 1 });
  await indexItem('lib', id, [body]);
}

export function Library() {
  const s = useSnapshot();
  const [open, setOpen] = useState<LibItem | 'new' | null>(null);
  const [filter, setFilter] = useState<'all' | LibItem['kind']>('all');
  const st = useMemo(() => (s ? computeCity(s).find(b => b.kind === 'library')! : null), [s]);
  useEffect(() => {
    const f = (e: Event) => { if ((e as CustomEvent).detail === 'lib') setOpen('new'); };
    addEventListener('add-in-building', f); return () => removeEventListener('add-in-building', f);
  }, []);
  // ссылка, присланная быстрой командой iOS: #/library?url=...
  useEffect(() => {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const url = q.get('url');
    if (url) { setOpen({ id: '', updatedAt: 0, kind: /youtu/.test(url) ? 'video' : 'article', title: q.get('title') || '', url, status: 'new', addedAt: Date.now() }); location.hash = '/library'; }
  }, []);
  if (!s || !st) return <div className="scr" />;
  const list = [...s.lib].filter(x => filter === 'all' || x.kind === filter).sort((a, b) => b.addedAt - a.addedAt);
  return (
    <div className="scr">
      <Hero kind="library" decay={st.decay} name="Библиотека" level={st.level} xp={st.xp} prev={st.prev} next={st.next}
        status={st.decay ? 'в упадке' : `${s.lib.length} материалов`} statusColor={st.decay ? 'var(--bad)' : 'var(--ok)'} onBack={() => go('city')} />
      <ChatBox thread="lib" placeholder="Что я изучал про…" />
      <button className="btn main" onClick={() => setOpen('new')}>+ Книга, статья или видео</button>
      <Seg value={filter} options={[['all', 'Всё'], ...KIND]} onChange={setFilter} />
      <div className="card">
        {list.length === 0 && <div className="empty">Кидай сюда ссылки на статьи и видео YouTube, книги с заметками. Потом можно спросить, что ты изучал по теме.</div>}
        {list.map(x => (
          <TaskRow key={x.id} title={`${kindName(x.kind)} · ${x.title}`} on={x.status === 'done'}
            onToggle={() => save('lib', { ...x, status: x.status === 'done' ? 'reading' : 'done' })} onOpen={() => setOpen(x)}
            meta={`${x.summary ? 'конспект готов' : x.indexed ? 'сохранено' : 'обрабатывается'} · ${human(ymd(new Date(x.addedAt)))}`} />
        ))}
      </div>
      {open && <Sheet onClose={() => setOpen(null)}><ItemForm row={open === 'new' ? undefined : open} onDone={() => setOpen(null)} /></Sheet>}
    </div>
  );
}

function ItemForm({ row, onDone }: { row?: LibItem; onDone: () => void }) {
  const [kind, setKind] = useState<LibItem['kind']>(row?.kind || 'video');
  const [title, setTitle] = useState(row?.title || '');
  const [url, setUrl] = useState(row?.url || '');
  const [notes, setNotes] = useState(row?.notes || '');
  const [busy, setBusy] = useState(false);
  const isNew = !row?.id;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !url.trim()) return;
    setBusy(true);
    const it = await save('lib', { id: row?.id || uid(), kind, title: title.trim(), url: url.trim() || undefined, notes, status: row?.status || 'new', addedAt: row?.addedAt || Date.now(), summary: row?.summary, ideas: row?.ideas, text: row?.text, indexed: 0 });
    toast(isNew ? 'Сохранил, делаю конспект' : 'Сохранено');
    onDone();
    processItem(it.id).then(() => isNew && toast('Конспект готов'));
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{isNew ? 'В библиотеку' : row!.title}</h3>
      <Seg value={kind} options={KIND} onChange={setKind} />
      {kind !== 'book' && <Field label="Ссылка"><input className="in" autoFocus={isNew} value={url} onChange={e => setUrl(e.target.value)} placeholder={kind === 'video' ? 'https://youtu.be/…' : 'https://…'} /></Field>}
      <Field label="Название"><input className="in" value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'book' ? 'Название и автор' : 'Подставлю сам, если пусто'} /></Field>
      {row?.summary && <div className="card sunk"><b>Конспект</b><div className="ans">{row.summary}</div>{(row.ideas || []).map((i, n) => <div key={n} className="src" style={{ color: 'var(--ink)' }}>• {i}</div>)}</div>}
      <Field label="Мои заметки и выделения"><textarea className="in" value={notes} onChange={e => setNotes(e.target.value)} style={{ minHeight: 110 }} /></Field>
      <div className={isNew ? '' : 'btns'}>
        {!isNew && <button type="button" className="btn danger" onClick={async () => {
          await remove('lib', row!.id);
          for (const c of await db.chunks.where('parentId').equals(row!.id).toArray()) await remove('chunks', c.id);
          onDone();
        }}>Удалить</button>}
        <button className="btn main" disabled={busy}>Сохранить</button>
      </div>
    </form>
  );
}
