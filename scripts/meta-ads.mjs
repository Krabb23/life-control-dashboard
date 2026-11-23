// Робот Meta: каждое утро берёт вчерашние цифры по всем рекламным кабинетам и отправляет в Лайф Сити.
// Нужны секреты репозитория: META_TOKEN (системный пользователь), WORKER_URL, APP_TOKEN.
const { META_TOKEN, WORKER_URL, APP_TOKEN } = process.env;
const V = 'v21.0';
if (!META_TOKEN || !WORKER_URL || !APP_TOKEN) { console.log('Нет секретов META_TOKEN / WORKER_URL / APP_TOKEN, пропускаю'); process.exit(0); }

const app = async (path, body) => {
  const r = await fetch(WORKER_URL.replace(/\/$/, '') + path, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + APP_TOKEN, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(path + ': ' + r.status + ' ' + await r.text());
  return r.json();
};
const graph = async (path, params = {}) => {
  const u = new URL(`https://graph.facebook.com/${V}/${path}`);
  for (const [k, v] of Object.entries({ ...params, access_token: META_TOKEN })) u.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  const r = await fetch(u); const j = await r.json();
  if (j.error) throw new Error(path + ': ' + j.error.message);
  return j;
};
const count = async (path, params) => { let n = 0, j = await graph(path, { ...params, fields: 'id', limit: 500 }); for (;;) { n += j.data.length; if (!j.paging?.next) return n; j = await (await fetch(j.paging.next)).json(); } };

// вчера по Алматы (UTC+5)
const date = new Date(Date.now() + 5 * 3600e3 - 86400e3).toISOString().slice(0, 10);
const { projects } = await app('/ads/projects');
const stats = [];
for (const p of projects) {
  try {
    const act = p.adAccountId.startsWith('act_') ? p.adAccountId : 'act_' + p.adAccountId;
    const ins = (await graph(`${act}/insights`, { level: 'account', time_range: { since: date, until: date }, fields: 'spend,impressions,clicks,ctr,cpm,actions' })).data[0] || {};
    const want = (p.leadActions || 'lead').split(',').map(s => s.trim()).filter(Boolean);
    const leads = (ins.actions || []).filter(a => want.includes(a.action_type)).reduce((s, a) => s + Number(a.value), 0);
    const spend = Number(ins.spend || 0);
    stats.push({
      projectId: p.id, date, spend, leads,
      impressions: Number(ins.impressions || 0), clicks: Number(ins.clicks || 0),
      ctr: ins.ctr != null ? Number(ins.ctr) : null, cpm: ins.cpm != null ? Number(ins.cpm) : null,
      cpl: leads ? Math.round((spend / leads) * 100) / 100 : null,
      rejected: await count(`${act}/ads`, { effective_status: ['DISAPPROVED'] }),
      activeCampaigns: await count(`${act}/campaigns`, { effective_status: ['ACTIVE'] })
    });
    console.log(`${p.name}: ${spend} расход, ${leads} лидов`);
  } catch (e) { console.log(`${p.name}: ошибка ${e.message}`); }
}
console.log(await app('/ads/ingest', { stats }));
