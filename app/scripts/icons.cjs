// Рисует иконки приложения из того же SVG, что и город (Ратуша на островке).
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const path = require('node:path');
(async () => {
const src = readFileSync(path.join(__dirname, '../src/scene/draw.ts'), 'utf8')
  .replace('// @ts-nocheck', '').replace(/^export \{[^}]*\};?$/m, '').replace(/^export /gm, '');
const b = await chromium.launch();
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
for (const [size, pad, name] of [[512, 0.06, 'icon-512'], [192, 0.06, 'icon-192'], [180, 0.06, 'apple-touch-icon'], [512, 0.18, 'icon-512-maskable']]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0"><div id="r" style="width:${size}px;height:${size}px;background:linear-gradient(180deg,#FAD8C3,#F7C3C6 55%,#E7CCEA);display:grid;place-items:center"></div>
  <script>{${src}; document.getElementById('r').innerHTML = svgHero('hall', false).replace('class="bld"', 'style="width:${Math.round(size * (1 - pad * 2))}px;height:${Math.round(size * (1 - pad * 2))}px"');}</script></body></html>`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, `../public/icons/${name}.png`) });
}
await b.close();
console.log('icons ok');
})();
