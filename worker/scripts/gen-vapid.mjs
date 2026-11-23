// Печатает пару ключей для пуш-уведомлений: node scripts/gen-vapid.mjs
const b64u = b => Buffer.from(b).toString('base64url');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
console.log('VAPID_PUBLIC=' + b64u(pub));
console.log('VAPID_PRIVATE=' + jwk.d);
