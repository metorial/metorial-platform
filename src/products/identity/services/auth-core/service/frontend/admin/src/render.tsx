import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link } from 'react-router-dom';
import { App } from './router';

import './reset.css';

(window as any).LinkComponent = Link;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
