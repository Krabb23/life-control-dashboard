// Web Push без внешних библиотек: шифрование aes128gcm (RFC 8291) и подпись VAPID (RFC 8292) на WebCrypto.

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }
export interface Vapid { publicKey: string; privateKey: string; subject: string } // ключи в base64url: публичный 65 байт, приватный d 32 байта

const enc = new TextEncoder();
export const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s: string) => {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(t, c => c.charCodeAt(0));
};
const concat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

export async function encryptPayload(sub: PushSub, payload: Uint8Array, salt = crypto.getRandomValues(new Uint8Array(16)), asKeys?: CryptoKeyPair) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = asKeys || (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as never, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

async function vapidJwt(endpoint: string, v: Vapid) {
  const pub = unb64u(v.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: v.privateKey, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(header + '.' + body));
  return header + '.' + body + '.' + b64u(sig);
}

// Отправка. Возвращает статус: 201 - ок, 404/410 - подписка умерла, её надо удалить.
export async function sendPush(sub: PushSub, data: unknown, v: Vapid, ttl = 86400) {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(data)));
  const jwt = await vapidJwt(sub.endpoint, v);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(ttl), urgency: 'high', authorization: `vapid t=${jwt}, k=${v.publicKey}` },
    body
  });
  return r.status;
}

export async function generateVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey) as JsonWebKey;
  return { publicKey: b64u(pub), privateKey: jwk.d! };
}
