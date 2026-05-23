import { createHono } from '@mtsrc/hono';
import { publicApp } from './public';

export let endpointApp = createHono().route('', publicApp);
