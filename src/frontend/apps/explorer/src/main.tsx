import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ExplorerApp } from './app';

import './reset.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExplorerApp />
  </StrictMode>
);
