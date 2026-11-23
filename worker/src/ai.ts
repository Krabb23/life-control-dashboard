// Вопросы к ИИ, конспекты статей и видео, поля договоров.
import type { Env } from './env';
import { generate, parseJson } from './gemini';

const SYSTEM = `Ты второй мозг Раймбека: таргетолог из Алматы, ведёт рекламу для нескольких клиентов. Отвечай по-русски, на «ты», коротко и прямо, сначала ответ, потом детали. Числа цифрами.
Опирайся на найденные фрагменты его документов и заметок и на сводку из приложения. Ссылайся на фрагменты номерами в квадратных скобках, например [2].
Если в фрагментах ответа нет, так и скажи: «в твоих записях этого нет», и только потом можешь добавить общий совет, явно пометив его как общий.`;

export async function ask(env: Env, b: { question: string; ctx: { title: string; where: string; text: string }[]; facts?: string; history?: { role: string; text: string }[] }) {
  const frags = b.ctx.map((c, i) => `[${i + 1}] ${c.title}${c.where ? ', ' + c.where : ''}:\n${c.text}`).join('\n\n');
  const hist = (b.history || []).slice(-6).map(h => `${h.role === 'user' ? 'Вопрос' : 'Ответ'}: ${h.text}`).join('\n');
  const prompt = [
    frags ? `Фрагменты из его записей:\n${frags}` : 'Фрагментов по теме не нашлось.',
    b.facts ? `Сводка из приложения:\n${b.facts}` : '',
    hist ? `Предыдущая переписка:\n${hist}` : '',
    `Вопрос: ${b.question}`
  ].filter(Boolean).join('\n\n');
  const r = await generate(env, 'chat', SYSTEM, [{ text: prompt }]);
  const used = [...new Set([...r.text.matchAll(/\[(\d{1,2})\]/g)].map(m => Number(m[1])).filter(n => n >= 1 && n <= b.ctx.length))];
  return { text: r.text.replace(/\s?\[(\d{1,2})\]/g, '').trim(), model: r.model, used };
}

function htmlToText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const main = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
  const text = main.replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|h\d|li)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&mdash;/g, '-')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  return { title: title.replace(/&[a-z#0-9]+;/gi, ' '), text };
}

const SUMMARY = 'Верни JSON {"title": "...", "summary": "3-5 предложений по сути", "ideas": ["5-8 главных идей и приёмов, каждая до 150 символов"], "text": "подробный конспект до 3000 символов"}. Пиши по-русски, даже если источник на другом языке.';

export async function extract(env: Env, b: Record<string, string>) {
  switch (b.kind) {
    case 'contract': {
      const r = await generate(env, 'chat', 'Ты разбираешь документы. Отвечай только JSON.', [{ text:
        `Из текста документа достань поля. Верни JSON {"title":"короткое название, например «Договор аренды квартиры»","type":"contract|lease|invoice|other","parties":"стороны","amount":"сумма и периодичность","endDate":"YYYY-MM-DD или пусто","termination":"условия досрочного расторжения одной фразой","summary":"суть в 2 предложениях"}. Если поля нет, пустая строка.\n\nТекст:\n${(b.text || '').slice(0, 15000)}` }], { json: true });
      return parseJson(r.text);
    }
    case 'article': {
      const page = await fetch(b.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; LifeCity/1.0)', accept: 'text/html' } });
      if (!page.ok) throw new Error('Страница не открылась: ' + page.status);
      const { title, text } = htmlToText(await page.text());
      if (text.length < 200) throw new Error('На странице мало текста, возможно платный доступ. Вставь текст в заметки');
      const r = await generate(env, 'chat', 'Ты делаешь конспекты для личной библиотеки. Отвечай только JSON.', [{ text: `${SUMMARY}\nЗаметки владельца: ${b.notes || 'нет'}\nЗаголовок: ${title}\n\nТекст статьи:\n${text.slice(0, 30000)}` }], { json: true });
      const j = parseJson<Record<string, unknown>>(r.text);
      return { ...j, title: j.title || title, text: String(j.text || '') + '\n\n' + text.slice(0, 12000) };
    }
    case 'video': {
      let title = '';
      try { const o = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(b.url)); if (o.ok) title = ((await o.json()) as { title: string }).title; } catch { /* без названия */ }
      // Gemini умеет смотреть видео YouTube по ссылке
      const r = await generate(env, 'chat', 'Ты делаешь конспекты видео для личной библиотеки. Отвечай только JSON.',
        [{ file_data: { file_uri: b.url } }, { text: `${SUMMARY}\nНазвание: ${title}\nЗаметки владельца: ${b.notes || 'нет'}` }], { json: true });
      const j = parseJson<Record<string, unknown>>(r.text);
      return { ...j, title: title || j.title };
    }
    case 'library': {
      const r = await generate(env, 'chat', 'Ты делаешь конспекты для личной библиотеки. Отвечай только JSON.', [{ text: `По заметкам владельца о книге «${b.title}» верни JSON {"summary":"суть в 3 предложениях","ideas":["главные идеи"]}. Не добавляй того, чего нет в заметках.\n\nЗаметки:\n${(b.notes || '').slice(0, 20000)}` }], { json: true });
      return parseJson(r.text);
    }
  }
  throw new Error('Неизвестный тип');
}
