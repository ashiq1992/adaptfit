import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startUsageCount } from './data/usageCount';
import { initPwa } from './pwa';
import { applyTheme, getTheme } from './ui/theme';
import './ui/tokens.css';
import './ui/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void initPwa();
startUsageCount();
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (getTheme() === 'auto') applyTheme('auto');
});
