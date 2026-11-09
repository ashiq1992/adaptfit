import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startUsageCount } from './data/usageCount';
import { captureSharedText } from './features/importer/sharedText';
import { initPwa } from './pwa';
import { applyTheme, getTheme } from './ui/theme';
import './ui/tokens.css';
import './ui/app.css';

// Opened from another app's Share menu (Android): go straight to Import with the text.
captureSharedText();

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
