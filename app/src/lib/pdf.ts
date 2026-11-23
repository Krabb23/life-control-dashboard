// Достаём текст из PDF прямо на устройстве (pdf.js). Сервер для этого не нужен.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfText { pages: string[]; lines: string[][] }

export async function pdfText(data: ArrayBuffer): Promise<PdfText> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [], lines: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // собираем строки по координате y, внутри строки сортируем по x
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      if (!('str' in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], s: it.str });
    }
    const ls = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(z => z.s).join(' ').replace(/\s+/g, ' ').trim());
    lines.push(ls);
    pages.push(ls.join('\n'));
  }
  return { pages, lines };
}
