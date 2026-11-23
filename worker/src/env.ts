export interface Env {
  DB: D1Database;
  FILES?: R2Bucket;            // необязательно: без R2 файлы лежат в D1 кусками
  APP_TOKEN: string;           // ключ доступа приложения
  GEMINI_API_KEY: string;
  VAPID_PUBLIC: string;
  VAPID_PRIVATE: string;
  VAPID_SUBJECT: string;
  GH_TOKEN?: string;           // для кнопки «Обновить сейчас» (запуск робота Meta)
  GH_REPO: string;
  GH_WORKFLOW: string;
  TZ_OFFSET_MIN: string;       // 300 = Алматы
  MODEL_CHAT: string;
  MODEL_SMART: string;
  MODEL_FALLBACK: string;
  MODEL_EMBED: string;
  APP_URL: string;
}
