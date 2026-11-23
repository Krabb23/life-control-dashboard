import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';
import { db, save } from './db';

// Отладка: ?debug открывает доступ к базе из консоли
if (location.search.includes('debug')) Object.assign(window, { lc: { db, save } });

registerSW({ immediate: true });
// Просим браузер не чистить локальную базу при нехватке места
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
