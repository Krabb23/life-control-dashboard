import { vapidKey, pushSubscribe } from './api';

const b64ToBytes = (b: string) => {
  const s = atob(b.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function pushSupport(): { ok: boolean; why?: string } {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (isIOS() && !isStandalone()) return { ok: false, why: 'На iPhone уведомления работают только из приложения на экране «Домой». В Safari нажми «Поделиться» → «На экран Домой», открой Лайф Сити оттуда и включи уведомления.' };
    return { ok: false, why: 'Этот браузер не умеет пуш-уведомления.' };
  }
  return { ok: true };
}

// Включение пушей: вызывать только по нажатию кнопки (требование iOS).
export async function enablePush(device: string) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Уведомления не разрешены. Включи их в настройках устройства для Лайф Сити');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await vapidKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await pushSubscribe(sub.toJSON(), device);
}
