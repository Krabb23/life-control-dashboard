import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, save, uid, alive, getSetting, setSetting, type Txn } from '../db';
import { Bar, Field, Hero, Row, Sheet, useSnapshot, toast } from '../components/ui';
import { computeCity } from '../lib/game';
import { human, money, monthKey, monthGen, today } from '../lib/dates';
import { TxnForm } from './Add';
import { parseStatement, guessAccount } from '../lib/kaspi';
import { go } from '../lib/nav';

export function Bank() {
  const s = useSnapshot();
  const limit = useLiveQuery(() => getSetting<number>('monthLimit', 0)) ?? 0;
  const rules = alive(useLiveQuery(() => db.catRules.toArray()) || []);
  const [edit, setEdit] = useState<Txn | 'new' | 'limit' | null>(null);
  const [lim, setLim] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const st = useMemo(() => (s ? computeCity(s).find(b => b.kind === 'bank')! : null), [s]);
  if (!s || !st) return <div className="scr" />;

  const mk = monthKey(), t = today();
  const month = s.txns.filter(x => x.date.startsWith(mk) && !x.transfer);
  const spent = -month.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0);
  const earned = month.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const now = new Date(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = dim - now.getDate() + 1;
  const spentToday = -month.filter(x => x.amount < 0 && x.date === t).reduce((a, x) => a + x.amount, 0);
  const perDay = limit ? Math.max(0, (limit - spent + spentToday) / left - spentToday) : 0;
  const byCat = Object.entries(month.filter(x => x.amount < 0).reduce<Record<string, number>>((a, x) => { a[x.category] = (a[x.category] || 0) - x.amount; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const recent = [...s.txns].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 15);

  const importPdf = async (f: File) => {
    try {
      toast('Читаю выписку…');
      const { pdfText } = await import('../lib/pdf');
      const pdf = await pdfText(await f.arrayBuffer());
      const all = pdf.lines.flat();
      const account = guessAccount(pdf.pages[0] || '');
      const parsed = parseStatement(all, rules);
      if (!parsed.length) { toast('Не нашёл операций в этом файле. Пришли выписку мне, подстрою разбор'); return; }
      let added = 0;
      for (const p of parsed) {
        const h = account + '|' + p.hash;
        if (await db.txns.where('hash').equals(h).count()) continue;
        await save('txns', { id: uid(), date: p.date, amount: p.amount, account, category: p.category, note: [p.op, p.details].filter(Boolean).join(' · '), source: 'import', hash: h, transfer: p.transfer });
        added++;
      }
      toast(added ? `Добавлено операций: ${added}, дубли пропущены` : 'Все операции уже были загружены');
    } catch (e) {
      console.error(e); toast('Не получилось прочитать PDF');
    }
  };

  return (
    <div className="scr">
      <Hero kind="bank" decay={st.decay} name="Казна" level={st.level} xp={st.xp} prev={st.prev} next={st.next}
        status={st.decay ? 'в упадке' : limit && spent > limit ? 'лимит превышен' : 'в пределах лимита'} statusColor={st.decay || (limit && spent > limit) ? 'var(--bad)' : 'var(--ok)'} onBack={() => go('city')} />
      {st.decay && <div className="card alert"><b style={{ color: 'var(--bad)' }}>{st.reason}</b><span className="src">Загрузи выписку Kaspi или запиши расход, и Казна оживёт.</span></div>}
      <div className="card click" onClick={() => { setLim(limit ? String(limit) : ''); setEdit('limit'); }}>
        {limit ? <>
          <div className="row"><span className="k">Можно тратить сегодня</span><span className="big">{money(perDay)}</span></div>
          <Row k={`Потрачено из лимита ${monthGen(mk)}`} v={`${money(spent)} из ${money(limit)}`} vc={spent > limit ? 'var(--bad)' : undefined} />
          <Bar p={spent / limit} c={spent > limit ? 'var(--bad)' : 'var(--ok)'} />
        </> : <>
          <b>Лимит на месяц не задан</b><span className="src">Задай сумму, и Казна будет считать, сколько можно тратить в день.</span>
        </>}
      </div>
      <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat"><span className="n">{money(spent)}</span><span className="l">расходы за месяц</span></div>
        <div className="stat"><span className="n" style={{ color: 'var(--ok)' }}>{money(earned)}</span><span className="l">доходы за месяц</span></div>
      </div>
      <div className="btns"><button className="btn" onClick={() => setEdit('new')}>+ Запись</button><button className="btn main" onClick={() => fileRef.current?.click()}>Выписка PDF</button></div>
      <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importPdf(f); e.target.value = ''; }} />
      <div className="src">Kaspi: в приложении Kaspi открой Kaspi Gold → Выписка → PDF и загрузи файл сюда. Наличку записывай кнопкой «+».</div>
      {byCat.length > 0 && <div className="card"><h3>Куда ушли деньги</h3>
        {byCat.slice(0, 8).map(([c, v]) => <div key={c}><Row k={c} v={money(v)} /><Bar p={v / byCat[0][1]} c="var(--coin)" /></div>)}</div>}
      <div className="card"><h3>Последние операции</h3>
        {recent.length === 0 && <div className="empty">Операций пока нет</div>}
        {recent.map(x => (
          <div key={x.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => setEdit(x)}>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700 }}>{x.category}{x.transfer ? ' · не расход' : ''}</div><div className="src" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{human(x.date)} · {x.account === 'cash' ? 'наличка' : x.account === 'kaspi' ? 'Kaspi' : 'Freedom'}{x.note ? ' · ' + x.note : ''}</div></div>
            <b style={{ color: x.amount > 0 ? 'var(--ok)' : undefined, whiteSpace: 'nowrap' }}>{x.amount > 0 ? '+' : ''}{money(x.amount)}</b>
          </div>
        ))}
      </div>
      {edit && <Sheet onClose={() => setEdit(null)}>
        {edit === 'limit' ? (
          <form style={{ display: 'contents' }} onSubmit={async e => { e.preventDefault(); await setSetting('monthLimit', Number(lim.replace(/\s/g, '')) || 0); setEdit(null); }}>
            <h3>Лимит расходов на месяц</h3>
            <Field label="Сумма, ₸"><input className="in" autoFocus inputMode="numeric" value={lim} onChange={e => setLim(e.target.value)} /></Field>
            <button className="btn main">Сохранить</button>
          </form>
        ) : edit === 'new' ? <TxnForm onDone={() => setEdit(null)} /> : <TxnEdit row={edit} onDone={() => setEdit(null)} />}
      </Sheet>}
    </div>
  );
}

// Правка операции + «запомнить категорию для этого места»
function TxnEdit({ row, onDone }: { row: Txn; onDone: () => void }) {
  const [learn, setLearn] = useState(false);
  return (
    <>
      <TxnForm row={row} onDone={async () => {
        if (learn && row.note) {
          const cur = await db.txns.get(row.id);
          const key = (row.note.split(' · ')[1] || row.note).trim().slice(0, 40);
          if (cur && key) {
            await save('catRules', { id: uid(), match: key, category: cur.category });
            for (const x of alive(await db.txns.toArray()).filter(x => x.note?.includes(key) && x.category !== cur.category && x.source === 'import')) await save('txns', { ...x, category: cur.category });
          }
        }
        onDone();
      }} />
      {row.source === 'import' && <>
        <label className="row" style={{ cursor: 'pointer' }}><span>Запомнить категорию для этого места</span><input type="checkbox" checked={learn} onChange={e => setLearn(e.target.checked)} style={{ width: 22, height: 22 }} /></label>
        <button className="btn sm" onClick={async () => { await save('txns', { ...row, transfer: row.transfer ? 0 : 1 }); onDone(); }}>{row.transfer ? 'Считать расходом' : 'Это перевод себе, не расход'}</button>
      </>}
    </>
  );
}
