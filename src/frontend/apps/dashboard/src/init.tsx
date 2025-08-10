import { setConfig } from '@metorial/frontend-config';

setConfig({
  apiUrl: import.meta.env.VITE_API_URL,
  privateApiUrl: import.meta.env.VITE_PRIVATE_API_URL,
  environment: import.meta.env.VITE_METORIAL_ENV
});
