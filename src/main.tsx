import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthGate } from './AuthGate';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { initDisplayMode } from './lib/uiPrefs';
import './index.css';

initDisplayMode();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=3').then(reg => {
      reg.update();
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('sw-reloaded')) return;
      sessionStorage.setItem('sw-reloaded', '1');
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthGate />
    </AppErrorBoundary>
  </StrictMode>,
);
