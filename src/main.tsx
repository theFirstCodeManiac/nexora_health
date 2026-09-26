import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerNexoraServiceWorker } from './lib/serviceWorkerManager.ts';

// Register the NEXORA offline-first Service Worker for asset & critical API caching
registerNexoraServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
