import { test } from 'node:test';
import assert from 'node:assert';
import { createECDH, randomBytes, createPublicKey, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { encryptPayload, b64u, generateVapid, sendPush } from '../src/webpush.ts';
const ece = createRequire(import.meta.url)('http_ece');

test('шифрование пуша расшифровывается эталонной библиотекой', async () => {
  const ua = createECDH('prime256v1'); ua.generateKeys();
  const auth = randomBytes(16);
  const sub = { endpoint: 'https://push.example.com/x', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } };
  const msg = JSON.stringify({ title: 'Созвон через 15 мин', body: 'Салон «Аура»' });
  const body = await encryptPayload(sub, new TextEncoder().encode(msg));
  const out = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret: auth });
  assert.strictEqual(out.toString('utf8'), msg);
});

test('подпись VAPID проверяется публичным ключом', async () => {
  const v = { ...(await generateVapid()), subject: 'mailto:test@example.com' };
  let captured: { url: string; headers: Record<string, string> } | null = null;
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { headers: Record<string, string> }) => { captured = { url, headers: init.headers }; return new Response(null, { status: 201 }); }) as never;
  const ua = createECDH('prime256v1'); ua.generateKeys();
  const st = await sendPush({ endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(randomBytes(16)) } }, { title: 'x' }, v);
  globalThis.fetch = orig;
  assert.strictEqual(st, 201);
  const m = captured!.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/)!;
  const [h, p, s] = m[1].split('.');
  const pub = Buffer.from(m[2], 'base64url');
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(verify('sha256', Buffer.from(h + '.' + p), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
  assert.strictEqual(JSON.parse(Buffer.from(p, 'base64url').toString()).aud, 'https://web.push.apple.com');
});
