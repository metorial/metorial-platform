import { setSentry } from '@metorial/sentry';
import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link } from 'react-router-dom';
import { App } from './router';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'https://f7965c2dded093e89187c3914b4806ad@o4508733999611904.ingest.de.sentry.io/4508738220195920',

    integrations: [Sentry.browserTracingIntegration()],

    tracesSampleRate: 1.0,

    tracePropagationTargets: [
      'localhost',
      'wsx',
      'chronos',
      'vulcan',
      // All metorial.com subdomains
      /^https:\/\/.*\.metorial\.com/,
      // All metorial-staging.click subdomains
      /^https:\/\/.*\.metorial-staging\.click/
    ],

    environment: process.env.METORIAL_ENV || process.env.VITE_METORIAL_ENV,

    ignoreErrors: [
      'not found',
      'not be found',
      'internal server error',
      'bad_request',
      'not authorized',
      'Unable to reach server'
    ]
  });

  setSentry(Sentry as any);
}

import './reset.css';

(window as any).LinkComponent = Link;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
