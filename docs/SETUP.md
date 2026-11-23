# Запуск Лайф Сити

Всё бесплатно: приложение и сервер на Cloudflare, ИИ на бесплатном ключе Gemini, цифры рекламы через GitHub. Без сервера приложение тоже работает, только на одном устройстве и без ИИ, пушей и рекламы.

## 1. Cloudflare (сервер и база)

1. Зарегистрируйся на dash.cloudflare.com (карта не нужна).
2. На Mac в папке проекта:
   ```
   cd worker
   npm install
   npx wrangler login
   npx wrangler d1 create life-city
   ```
   Команда выдаст `database_id` - вставь его в `worker/wrangler.toml` вместо `REPLACE_WITH_D1_ID`.
3. Создай таблицы:
   ```
   npx wrangler d1 execute life-city --remote --file schema.sql
   ```
4. Ключи для пушей:
   ```
   node scripts/gen-vapid.mjs
   ```
5. Секреты сервера (каждая команда спросит значение):
   ```
   npx wrangler secret put APP_TOKEN        # придумай длинный пароль, 30+ символов
   npx wrangler secret put GEMINI_API_KEY   # из пункта 2 ниже
   npx wrangler secret put VAPID_PUBLIC     # из gen-vapid
   npx wrangler secret put VAPID_PRIVATE    # из gen-vapid
   npx wrangler secret put VAPID_SUBJECT    # mailto:твоя-почта
   npx wrangler secret put GH_TOKEN         # необязательно, для кнопки «Обновить сейчас»
   ```
6. Выкати сервер: `npx wrangler deploy`. Он покажет адрес вида `https://life-city.<имя>.workers.dev`.

## 2. Ключ Gemini

aistudio.google.com → Get API key → Create API key. Бесплатный тариф. Ключ - в `GEMINI_API_KEY` из пункта 1.5.

## 3. Приложение

```
cd app
npm install
npm run build
npx wrangler pages deploy dist --project-name life-city
```
Получишь адрес вида `https://life-city.pages.dev`. Открой его, зайди в Настройки (шестерёнка в Городе), вставь адрес сервера и пароль `APP_TOKEN`, нажми «Проверить».

## 4. Телефон и Mac

- iPhone: открой адрес в Safari → Поделиться → «На экран Домой». Пуши на iPhone работают только из установленного так приложения. Потом Настройки → «Включить уведомления».
- Mac: открой в Safari → Файл → «Добавить в Dock», или в Chrome → значок установки в адресной строке.
- Ярлык «В Лайф Сити» для ссылок на статьи и видео: Команды → новая команда → «Получить URL из входных данных» → «Открыть URL» с адресом `https://life-city.pages.dev/#/library?url=` + ссылка. Включи «Показывать в меню Поделиться».

## 5. Реклама Meta (каждое утро в 9:30)

1. business.facebook.com → Настройки компании → Пользователи → Системные пользователи → Добавить (роль Администратор).
2. Назначь ему все рекламные кабинеты клиентов (доступ «Просмотр результатов» достаточно).
3. «Создать токен» → приложение компании → права `ads_read`, `read_insights`. Срок - бессрочный.
4. В GitHub: репозиторий → Settings → Secrets and variables → Actions → New secret:
   - `META_TOKEN` - токен системного пользователя
   - `WORKER_URL` - адрес сервера из пункта 1.6
   - `APP_TOKEN` - тот же пароль
5. В приложении в Агентстве добавь проекты: ID рекламного кабинета, целевой CPL и какие действия считать лидами (по умолчанию `lead`; для переписок `onsite_conversion.messaging_conversation_started_7d`).
6. Проверка: GitHub → Actions → meta-ads → Run workflow.

## 6. Kaspi и Freedom

Казна → «Выписка PDF» → файл из приложения банка. Категории учатся: поправил одну операцию - похожие подтянутся сами.

## Что по расписанию

- каждую минуту - напоминания и пуши календаря
- 9:30 - цифры рекламы
- 10:00 - брифинг на день
- 22:00 - разбор дня, если не закрыл день сам
- воскресенье 20:00 - итоги недели
