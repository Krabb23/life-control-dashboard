// Бесплатный Gemini API: перебор моделей при исчерпании лимита.
import type { Env } from './env';

export class LimitError extends Error {}

type Part = { text: string } | { file_data: { file_uri: string; mime_type?: string } };

const isGemma = (m: string) => /^gemma/i.test(m);

async function call(env: Env, model: string, system: string, parts: Part[], json: boolean, temperature: number) {
  const gemma = isGemma(model);
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: gemma && system ? [{ text: system + '\n\n' }, ...parts] : parts }],
    generationConfig: { temperature, ...(json && !gemma ? { responseMimeType: 'application/json' } : {}) }
  };
  if (system && !gemma) body.systemInstruction = { parts: [{ text: system }] };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify(body)
  });
  if (r.status === 429) throw new LimitError(model);
  if (!r.ok) throw new Error(`${model}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) throw new Error(model + ': пустой ответ');
  return text;
}

// tier: 'smart' - сначала умная модель (брифинг, разборы), 'chat' - сначала быстрая с большим лимитом
export async function generate(env: Env, tier: 'smart' | 'chat', system: string, parts: Part[], opts: { json?: boolean; temperature?: number } = {}) {
  const order = tier === 'smart' ? [env.MODEL_SMART, env.MODEL_CHAT, env.MODEL_FALLBACK] : [env.MODEL_CHAT, env.MODEL_FALLBACK, env.MODEL_SMART];
  let limited = 0, lastErr: unknown;
  for (const m of order.filter(Boolean)) {
    // видео умеют только модели Gemini, не Gemma
    if (isGemma(m) && parts.some(p => 'file_data' in p)) continue;
    try { return { text: await call(env, m, system, parts, !!opts.json, opts.temperature ?? 0.3), model: m }; }
    catch (e) { if (e instanceof LimitError) limited++; lastErr = e; }
  }
  if (limited) throw new LimitError('all');
  throw lastErr instanceof Error ? lastErr : new Error('ИИ не ответил');
}

export function parseJson<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /* ниже ищем JSON внутри текста */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('ИИ вернул не JSON');
  return JSON.parse(m[0]) as T;
}

export async function embed(env: Env, texts: string[]) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.MODEL_EMBED}:batchEmbedContents`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ requests: texts.map(t => ({ model: 'models/' + env.MODEL_EMBED, content: { parts: [{ text: t.slice(0, 8000) }] }, outputDimensionality: 768 })) })
  });
  if (r.status === 429) throw new LimitError('embed');
  if (!r.ok) throw new Error('embed ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json() as { embeddings: { values: number[] }[] };
  // округляем, чтобы векторы занимали меньше места в базе
  return j.embeddings.map(e => e.values.map(v => Math.round(v * 1e4) / 1e4));
}
