import { useEffect, useMemo, useRef, useState } from 'react';
import { db, save, remove, uid, type Doc } from '../db';
import { Field, Hero, Pill, Row, Seg, Sheet, useSnapshot, toast } from '../components/ui';
import { ChatBox } from '../components/Chat';
import { computeCity } from '../lib/game';
import { addDays, daysBetween, human, today } from '../lib/dates';
import { indexItem } from '../lib/search';
import { aiExtract, downloadFile, serverCfg } from '../lib/api';
import { go } from '../lib/nav';

const TYPES: [Doc['type'], string][] = [['contract', 'Договор'], ['lease', 'Аренда'], ['invoice', 'Счёт'], ['note', 'Заметка'], ['other', 'Другое']];
const typeName = (t: Doc['type']) => TYPES.find(x => x[0] === t)?.[1] || 'Документ';

// Добавление файла: храним у себя, текст достаём на устройстве, поля договора просим у ИИ.
export async function addFile(f: File, noAI = false) {
  const id = uid(), fileId = id + '-' + f.name.replace(/[^\w.\-]+/g, '_');
  await db.files.put({ id: fileId, blob: f, name: f.name, mime: f.type, uploaded: 0 });
  let pages: string[] = [];
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
    const { pdfText } = await import('../lib/pdf');
    pages = (await pdfText(await f.arrayBuffer())).pages;
  } else if (/^text\/|\.(md|txt|csv)$/i.test(f.type + f.name)) {
    pages = [await f.text()];
  }
  const text = pages.join('\n\n');
  const guess: Doc['type'] = /аренд|наём|найм/i.test(text) ? 'lease' : /договор|контракт|соглашени/i.test(text) ? 'contract' : /сч[её]т|invoice/i.test(text) ? 'invoice' : 'other';
  const doc = await save('docs', { id, title: f.name.replace(/\.[^.]+$/, ''), type: guess, fileId, fileName: f.name, mime: f.type, text, noAI: noAI ? 1 : 0, createdAt: Date.now() });
  if (!text.trim()) { toast('Файл сохранён. Текста в нём нет (скан или фото), искать по нему пока нельзя'); return doc; }
  await indexItem('doc', id, pages);
  await save('docs', { ...doc, indexed: 1 });
  if (!noAI) await extractFields(id);
  return doc;
}

export async function extractFields(id: string) {
  const d = await db.docs.get(id);
  if (!d || d.noAI || !d.text || !(await serverCfg())) return;
  try {
    const r = await aiExtract('contract', { text: d.text.slice(0, 15000) }) as { title?: string; type?: Doc['type']; parties?: string; amount?: string; endDate?: string; termination?: string; summary?: string };
    const fields = { parties: r.parties, amount: r.amount, endDate: r.endDate, termination: r.termination, summary: r.summary };
    await save('docs', { ...d, title: r.title || d.title, type: r.type || d.type, fields });
    // напоминание за 30 дней до конца срока
    if (r.endDate && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate) && daysBetween(today(), r.endDate) > 0) {
      const day = daysBetween(today(), r.endDate) > 30 ? addDays(r.endDate, -30) : today();
      const [y, m, dd] = day.split('-').map(Number);
      const at = new Date(y, m - 1, dd, 10, 0);
      if (at.getTime() < Date.now()) at.setTime(Date.now() + 3600_000);
      await save('reminders', { id: 'doc-end-' + id, title: `${r.title || d.title}: срок до ${human(r.endDate)}`, at: at.toISOString(), done: 0 });
    }
  } catch { /* поля не обязательны */ }
}

export function Brain() {
  const s = useSnapshot();
  const [open, setOpen] = useState<Doc | 'note' | null>(null);
  const [filter, setFilter] = useState<'all' | Doc['type']>('all');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = useMemo(() => (s ? computeCity(s).find(b => b.kind === 'brain')! : null), [s]);
  useEffect(() => {
    const f = (e: Event) => { const w = (e as CustomEvent).detail; if (w === 'note') setOpen('note'); if (w === 'file') fileRef.current?.click(); };
    addEventListener('add-in-building', f); return () => removeEventListener('add-in-building', f);
  }, []);
  if (!s || !st) return <div className="scr" />;
  const t = today();
  const soon = s.docs.filter(d => d.fields?.endDate && /^\d{4}-\d{2}-\d{2}$/.test(d.fields.endDate) && daysBetween(t, d.fields.endDate) >= 0 && daysBetween(t, d.fields.endDate) <= 30);
  const list = [...s.docs].filter(d => filter === 'all' || d.type === filter).sort((a, b) => b.createdAt - a.createdAt);
  const upload = async (files: FileList) => {
    setBusy(true);
    try { for (const f of Array.from(files)) { await addFile(f); } toast('Готово, можно спрашивать'); }
    catch (e) { console.error(e); toast('Не получилось обработать файл'); }
    finally { setBusy(false); }
  };

  return (
    <div className="scr" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}>
      <Hero kind="brain" decay={false} name="Второй мозг" level={st.level} xp={st.xp} prev={st.prev} next={st.next}
        status={`${s.docs.length} док.`} statusColor="var(--primary)" onBack={() => go('city')} />
      <ChatBox thread="brain" placeholder="Спроси о документах или о чём угодно" />
      {soon.map(d => (
        <div key={d.id} className="card alert click" style={{ gap: 6 }} onClick={() => setOpen(d)}>
          <div className="row"><b style={{ fontSize: 15 }}>Скоро истекает</b><Pill t={`${daysBetween(t, d.fields!.endDate!)} дн.`} c="var(--bad)" /></div>
          <div className="src" style={{ color: 'var(--ink)', fontSize: 13.5 }}>{d.title}. Напоминание стоит в календаре.</div>
        </div>
      ))}
      <div className="btns">
        <button className="btn" onClick={() => setOpen('note')}>+ Заметка</button>
        <button className="btn main" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Обрабатываю…' : '+ Файл или PDF'}</button>
      </div>
      <input ref={fileRef} type="file" multiple accept="application/pdf,image/*,text/*,.md,.txt" hidden onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = ''; }} />
      <Seg value={filter} options={[['all', 'Все'], ...TYPES]} onChange={setFilter} />
      <div className="card">
        {list.length === 0 && <div className="empty">Здесь будут договоры, аренды, счета и заметки. На Mac можно просто перетащить файл в окно.</div>}
        {list.map(d => (
          <div key={d.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => setOpen(d)}>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700 }}>{d.title}</div>
              <div className="src">{typeName(d.type)}{d.fields?.endDate ? ' · до ' + human(d.fields.endDate) : ''}{d.noAI ? ' · без ИИ' : ''}</div></div>
            <span className="tag">{d.fileName ? 'файл' : 'текст'}</span>
          </div>
        ))}
      </div>
      {open && <Sheet onClose={() => setOpen(null)}>{open === 'note' ? <NoteForm onDone={() => setOpen(null)} /> : <DocView doc={open} onDone={() => setOpen(null)} />}</Sheet>}
    </div>
  );
}

function NoteForm({ row, onDone }: { row?: Doc; onDone: () => void }) {
  const [title, setTitle] = useState(row?.title || '');
  const [text, setText] = useState(row?.text || '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !title.trim()) return;
    const d = await save('docs', { id: row?.id || uid(), title: title.trim() || text.trim().slice(0, 40), type: row?.type || 'note', text, createdAt: row?.createdAt || Date.now(), noAI: row?.noAI || 0 });
    await indexItem('doc', d.id, [d.title + '\n' + text]);
    toast('Заметка сохранена');
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <h3>{row ? 'Заметка' : 'Новая заметка'}</h3>
      <input className="in" placeholder="Заголовок" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="in" autoFocus placeholder="Текст заметки" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 200 }} />
      <button className="btn main">Сохранить</button>
    </form>
  );
}

function DocView({ doc, onDone }: { doc: Doc; onDone: () => void }) {
  const [editNote, setEditNote] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [type, setType] = useState(doc.type);
  const [end, setEnd] = useState(doc.fields?.endDate || '');
  if (editNote) return <NoteForm row={doc} onDone={onDone} />;
  const openFile = async () => {
    try {
      const local = doc.fileId ? await db.files.get(doc.fileId) : undefined;
      const blob = local?.blob || (doc.fileId ? await downloadFile(doc.fileId) : null);
      if (!blob) return;
      if (!local && doc.fileId) await db.files.put({ id: doc.fileId, blob, name: doc.fileName || 'file', mime: doc.mime || blob.type, uploaded: 1 });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { toast('Файл не скачался. Нужен интернет'); }
  };
  const saveMeta = async () => { await save('docs', { ...doc, title, type, fields: { ...doc.fields, endDate: end || undefined } }); toast('Сохранено'); onDone(); };
  return (
    <>
      <Field label="Название"><input className="in" value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Seg value={type} options={TYPES} onChange={setType} />
      {doc.fields?.summary && <div className="ans">{doc.fields.summary}</div>}
      {doc.fields?.parties && <Row k="Стороны" v={doc.fields.parties} />}
      {doc.fields?.amount && <Row k="Сумма" v={doc.fields.amount} />}
      {doc.fields?.termination && <div className="src">Расторжение: {doc.fields.termination}</div>}
      <Field label="Действует до"><input className="in" type="date" value={end} onChange={e => setEnd(e.target.value)} /></Field>
      <label className="row" style={{ cursor: 'pointer' }}><span>Не отправлять в ИИ</span>
        <input type="checkbox" checked={!!doc.noAI} onChange={async e => { await save('docs', { ...doc, noAI: e.target.checked ? 1 : 0 }); onDone(); }} style={{ width: 22, height: 22 }} /></label>
      {doc.text && <details><summary className="src" style={{ cursor: 'pointer' }}>Текст документа</summary><div className="ans" style={{ maxHeight: 260, overflow: 'auto', fontSize: 13 }}>{doc.text.slice(0, 6000)}</div></details>}
      <div className="btns">
        {doc.fileId ? <button className="btn" onClick={openFile}>Открыть файл</button> : <button className="btn" onClick={() => setEditNote(true)}>Редактировать</button>}
        <button className="btn main" onClick={saveMeta}>Сохранить</button>
      </div>
      {doc.fileId && !doc.fields && !doc.noAI && doc.text && <button className="btn sm" onClick={async () => { await extractFields(doc.id); onDone(); }}>Достать поля договора через ИИ</button>}
      <button className="btn danger sm" onClick={async () => {
        await remove('docs', doc.id);
        for (const c of await db.chunks.where('parentId').equals(doc.id).toArray()) await remove('chunks', c.id);
        onDone();
      }}>Удалить</button>
    </>
  );
}
