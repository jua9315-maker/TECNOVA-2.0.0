import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { MobileCompanionScanner } from './components/MobileCompanionScanner';
import './index.css';

const isElectronRuntime =
  typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);

const searchParams =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
const isMobileCompanionMode = searchParams.get('mobile-scanner') === '1';
const isMobilePreview =
  isMobileCompanionMode && searchParams.get('preview') === '1';

if (!isElectronRuntime && !isMobilePreview) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  isMobileCompanionMode ? (
    <MobileCompanionScanner preview={isMobilePreview} />
  ) : (
    <App />
  )
);
