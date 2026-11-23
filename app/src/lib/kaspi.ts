import type { Account } from '../db';

// Разбор строк банковской выписки (Kaspi Gold, Freedom) в операции.
// Формат Kaspi: «01.11.26 - 2 500,00 ₸ Покупка MAGNUM CASH&CARRY». Freedom проверим на реальной выписке.
export interface ParsedTxn { date: string; amount: number; op: string; details: string; hash: string; category: string; transfer: 0 | 1 }

const RX = /^(\d{2})\.(\d{2})\.(\d{2,4})\s*([+\-−–])\s*([\d\s ]+(?:[.,]\d{1,2})?)\s*(?:₸|KZT|т)\s*(.*)$/i;
const OPS = ['Покупка', 'Покупки', 'Пополнение', 'Перевод', 'Переводы', 'Снятие', 'Снятия', 'Разное', 'Платеж', 'Платежи', 'Платёж', 'Оплата'];

const KEYWORDS: [RegExp, string][] = [
  [/magnum|small|galmart|anvar|спар|spar|ветерок|продукт|market|маркет|арзан|fruit|meat|мясо|супермаркет|toimart/i, 'Еда'],
  [/glovo|wolt|yandex ?eda|яндекс ?еда|kfc|mcdonald|burger|coffee|кофе|cafe|кафе|restaurant|ресторан|pizza|пицц|starbucks|del papa|dodo|sushi|суши/i, 'Кафе'],
  [/yandex ?go|яндекс ?go|taxi|такси|uber|bolt|indriver|onay|azs|азс|helios|sinooil|qazaq ?oil|газпром|parking|парков/i, 'Транспорт'],
  [/apteka|аптек|clinic|клиник|med|мед|стомат|europharma|biosfera/i, 'Здоровье'],
  [/beeline|kcell|activ|tele2|altel|казахтелеком|kazakhtelecom|apple\.com|google|netflix|spotify|youtube|chatgpt|openai|anthropic|claude|notion|icloud|yandex ?plus/i, 'Связь и подписки'],
  [/facebk|facebook|meta ?platforms|instagram|fb\.me|tiktok ads/i, 'Реклама клиентов'],
  [/fitness|фитнес|gym|зал|invictus|sport|спорт/i, 'Спорт'],
  [/zara|lc waikiki|h&m|bershka|adidas|nike|одежд|обув|lamoda|wildberries|ozon/i, 'Одежда'],
  [/аренд|квартплат|коммунал|алсеко|alseco|kazakhstan energ|ерц|кск/i, 'Дом и аренда'],
  [/kinopark|кино|cinema|steam|playstation|chaplin/i, 'Развлечения'],
  [/udemy|coursera|skillbox|курс|обучен|book|книг|meloman|меломан/i, 'Обучение']
];

export function categorize(details: string, rules: { match: string; category: string }[], income: boolean): string {
  const d = details.toLowerCase();
  for (const r of rules) if (r.match && d.includes(r.match.toLowerCase())) return r.category;
  if (income) return /перевод|transfer/i.test(details) ? 'Другое' : 'Клиенты';
  for (const [rx, c] of KEYWORDS) if (rx.test(details)) return c;
  return 'Другое';
}

export function parseStatement(lines: string[], rules: { match: string; category: string }[]): ParsedTxn[] {
  const out: ParsedTxn[] = [];
  const seen = new Map<string, number>();
  for (const raw of lines) {
    const m = raw.replace(/ /g, ' ').match(RX);
    if (!m) continue;
    const [, dd, mm, yy, sign, amt, tail] = m;
    const year = yy.length === 2 ? '20' + yy : yy;
    const n = Number(amt.replace(/\s/g, '').replace(',', '.'));
    if (!n) continue;
    const neg = sign !== '+';
    let op = '', details = tail.trim();
    for (const o of OPS) if (details.toLowerCase().startsWith(o.toLowerCase())) { op = o; details = details.slice(o.length).trim(); break; }
    const date = `${year}-${mm}-${dd}`;
    const amount = neg ? -n : n;
    // одинаковые операции в один день различаем порядковым номером
    const base = `${date}|${amount}|${details}`;
    const k = (seen.get(base) || 0) + 1; seen.set(base, k);
    const isWithdraw = /сняти/i.test(op);
    out.push({
      date, amount, op, details, hash: base + '|' + k,
      category: isWithdraw ? 'Снятие наличных' : categorize(details || op, rules, !neg),
      transfer: isWithdraw ? 1 : 0
    });
  }
  return out;
}

export function guessAccount(text: string): Account {
  if (/freedom/i.test(text)) return 'freedom';
  return 'kaspi';
}
