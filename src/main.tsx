import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import '@fontsource/fasthand/400.css';
import '@fontsource-variable/caveat/wght.css';
import './ui/tokens.css';
import './ui/base.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
