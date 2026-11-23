import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getLocal, setLocal, SYNCED } from '../db';
import { Field, Head, Row, toast } from '../components/ui';
import { api, ApiError, pushTest } from '../lib/api';
import { syncNow } from '../lib/sync';
import { enablePush, pushSupport, isStandalone } from '../lib/push';
import { embedMissing } from '../lib/search';
import { go } from '../lib/nav';

export function Settings() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [device, setDevice] = useState('');
  const syncAt = useLiveQuery(() => getLocal<number>('syncAt', 0));
  const outbox = useLiveQuery(() => db.outbox.count());
  useEffect(() => {
    getLocal<{ url: string; token: string } | null>('server', null).then(c => { if (c) { setUrl(c.url); setToken(c.token); } });
    getLocal<string>('device', '').then(d => setDevice(d || (/iphone/i.test(navigator.userAgent) ? 'iPhone' : /mac/i.test(navigator.userAgent) ? 'Mac' : 'Устройство')));
  }, []);
  const ps = pushSupport();

  const connect = async () => {
    await setLocal('server', { url: url.trim(), token: token.trim() });
    await setLocal('device', device);
    try {
      await api('/ping');
      const r = await syncNow();
      toast(r ? `Подключено. Отправлено ${r.sent}, получено ${r.got}` : 'Подключено');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Сервер не ответил'); }
  };
  const exportAll = async () => {
    const data: Record<string, unknown[]> = {};
    for (const t of SYNCED) data[t] = await db.table(t).toArray();
    const blob = new Blob([JSON.stringify({ app: 'life-city', at: new Date().toISOString(), data })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `life-city-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const importAll = async (f: File) => {
    try {
      const j = JSON.parse(await f.text()) as { data: Record<string, { id: string; updatedAt: number }[]> };
      let n = 0;
      for (const t of SYNCED) for (const row of j.data[t] || []) {
        const cur = await db.table(t).get(row.id);
        if (!cur || cur.updatedAt < row.updatedAt) { await db.table(t).put(row); await db.outbox.put({ key: t + ':' + row.id, table: t, id: row.id }); n++; }
      }
      toast(`Восстановлено записей: ${n}`);
    } catch { toast('Это не файл копии Лайф Сити'); }
  };

  return (
    <div className="scr">
      <Head eyebrow={<button className="link" onClick={() => go('city')}>‹ Город</button>} title="Настройки" />
      <div className="card">
        <h3>Сервер и синхронизация</h3>
        <span className="src">Адрес и ключ появятся после установки сервера (инструкция в проекте). Без сервера всё работает, но только на этом устройстве и без ИИ.</span>
        <Field label="Адрес сервера"><input className="in" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://life-city.<имя>.workers.dev" autoCapitalize="off" /></Field>
        <Field label="Ключ доступа"><input className="in" type="password" value={token} onChange={e => setToken(e.target.value)} autoCapitalize="off" /></Field>
        <Field label="Название устройства"><input className="in" value={device} onChange={e => setDevice(e.target.value)} /></Field>
        <button className="btn main" onClick={connect}>Подключить</button>
        <Row k="Последняя синхронизация" v={syncAt ? new Date(syncAt).toLocaleString('ru-RU') : 'не было'} />
        <Row k="Ждут отправки" v={outbox ?? 0} />
        <button className="btn sm" onClick={async () => { try { const r = await syncNow(); toast(r ? `Отправлено ${r.sent}, получено ${r.got}` : 'Сервер не подключён'); } catch (e) { toast((e as Error).message); } }}>Синхронизировать сейчас</button>
      </div>
      <div className="card">
        <h3>Уведомления</h3>
        {!isStandalone() && <span className="src">Совет: поставь Лайф Сити как приложение. iPhone: Safari → «Поделиться» → «На экран Домой». Mac: Safari → Файл → «Добавить в Dock», или Chrome → значок установки в адресной строке.</span>}
        {ps.ok ? <>
          <button className="btn main" onClick={async () => { try { await enablePush(device); toast('Уведомления включены'); } catch (e) { toast((e as Error).message); } }}>Включить уведомления на этом устройстве</button>
          <button className="btn sm" onClick={async () => { try { await pushTest(); toast('Отправил тестовое уведомление'); } catch (e) { toast((e as Error).message); } }}>Проверить</button>
        </> : <span className="src" style={{ color: 'var(--bad)' }}>{ps.why}</span>}
      </div>
      <div className="card">
        <h3>ИИ и поиск</h3>
        <span className="src">Если документы добавлялись без интернета, поиск по смыслу для них досчитается здесь.</span>
        <button className="btn sm" onClick={async () => { try { const n = await embedMissing(); toast(n ? `Досчитано кусков: ${n}` : 'Всё уже готово'); } catch (e) { toast((e as Error).message); } }}>Досчитать поиск</button>
      </div>
      <div className="card">
        <h3>Копия данных</h3>
        <span className="src">Файл со всеми записями. Можно хранить у себя и восстановить на любом устройстве.</span>
        <div className="btns">
          <button className="btn sm" style={{ width: '100%' }} onClick={exportAll}>Скачать копию</button>
          <label className="btn sm" style={{ width: '100%' }}>Восстановить<input type="file" accept="application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importAll(f); }} /></label>
        </div>
      </div>
      <div className="src" style={{ textAlign: 'center' }}>Лайф Сити 0.1</div>
    </div>
  );
}
