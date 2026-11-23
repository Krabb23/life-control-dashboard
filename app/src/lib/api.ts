import { getLocal } from '../db';

// Связь с облачным сервером (Cloudflare Worker). Без настроек приложение работает только локально.
export interface ServerCfg { url: string; token: string }
export async function serverCfg(): Promise<ServerCfg | null> {
  const c = await getLocal<ServerCfg | null>('server', null);
  return c && c.url && c.token ? c : null;
}

export class ApiError extends Error {
  constructor(public code: 'noserver' | 'offline' | 'auth' | 'limit' | 'server', msg: string) { super(msg); }
}

export async function api<T = unknown>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const c = await serverCfg();
  if (!c) throw new ApiError('noserver', 'Сервер не подключён. Открой Город → Настройки.');
  if (!navigator.onLine) throw new ApiError('offline', 'Нет интернета');
  let r: Response;
  try {
    r = await fetch(c.url.replace(/\/$/, '') + path, {
      method: body === undefined && !init.method ? 'GET' : init.method || 'POST',
      ...init,
      headers: {
        authorization: 'Bearer ' + c.token,
        ...(body !== undefined && !(body instanceof Blob) ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {})
      },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body)
    });
  } catch {
    throw new ApiError('offline', 'Сервер не отвечает');
  }
  if (r.status === 401) throw new ApiError('auth', 'Неверный ключ доступа к серверу');
  if (r.status === 429) throw new ApiError('limit', 'Дневной лимит бесплатного ИИ закончился, попробуй завтра');
  if (!r.ok) throw new ApiError('server', (await r.text().catch(() => '')) || 'Ошибка сервера ' + r.status);
  const ct = r.headers.get('content-type') || '';
  return (ct.includes('json') ? r.json() : r.blob()) as Promise<T>;
}

// ---------- ИИ ----------
export interface AiCtx { title: string; where: string; text: string }
export interface AiAnswer { text: string; model: string; used: number[] }

export const aiAsk = (question: string, ctx: AiCtx[], facts: string, history: { role: string; text: string }[]) =>
  api<AiAnswer>('/ai/ask', { question, ctx, facts, history });

export const aiEmbed = (texts: string[]) => api<{ vectors: number[][] }>('/ai/embed', { texts });

export const aiExtract = (kind: 'contract' | 'library' | 'video' | 'article' | 'categorize', input: Record<string, unknown>) =>
  api<Record<string, unknown>>('/ai/extract', { kind, ...input });

// ---------- файлы ----------
export const uploadFile = (id: string, blob: Blob) =>
  api('/files/' + encodeURIComponent(id), blob, { method: 'PUT', headers: { 'content-type': blob.type || 'application/octet-stream' } });
export const downloadFile = (id: string) => api<Blob>('/files/' + encodeURIComponent(id));

// ---------- пуши ----------
export const vapidKey = () => api<{ key: string }>('/push/key');
export const pushSubscribe = (sub: PushSubscriptionJSON, device: string) => api('/push/subscribe', { sub, device });
export const pushTest = () => api('/push/test', {});

// ---------- реклама ----------
export const adsRefresh = () => api<{ ok: boolean; note?: string }>('/ads/refresh', {});
