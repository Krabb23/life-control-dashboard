import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, alive, remove } from '../db';
import { ask } from '../lib/search';
import { ApiError } from '../lib/api';
import { toast } from './ui';

// Переписка с ИИ внутри здания: последние сообщения, ответы со ссылками на источники.
export function ChatBox({ thread, placeholder }: { thread: 'brain' | 'lib'; placeholder: string }) {
  const msgs = alive(useLiveQuery(() => db.chat.orderBy('at').toArray()) || []).filter(m => m.thread === thread).slice(-12);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    setQ(''); setBusy(true);
    try { await ask(text, thread); }
    catch (err) { toast(err instanceof ApiError ? err.message : 'ИИ сейчас не ответил'); }
    finally { setBusy(false); }
  };
  const clear = async () => { for (const m of msgs) await remove('chat', m.id); };
  return (
    <>
      {msgs.map(m => m.role === 'user'
        ? <div key={m.id} className="bub">{m.text}</div>
        : <div key={m.id} className="card"><div className="ans">{m.text}</div>
            {(m.cites || []).map((c, i) => <span key={i} className="cite">{c.title}{c.where ? ' · ' + c.where : ''}</span>)}</div>)}
      {busy && <div className="card"><div className="ans" style={{ color: 'var(--muted)' }}>Ищу в твоих записях…</div></div>}
      <form className="ask" onSubmit={send}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} enterKeyHint="send" />
        <button disabled={busy || !q.trim()} aria-label="Спросить">↑</button>
      </form>
      {msgs.length > 0 && <button className="link" style={{ alignSelf: 'flex-end', fontSize: 13 }} onClick={clear}>Очистить переписку</button>}
    </>
  );
}
