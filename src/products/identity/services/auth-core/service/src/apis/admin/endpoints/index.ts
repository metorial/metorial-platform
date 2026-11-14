import { createHono } from '@lowerdeck/hono';
import { publicApp } from './public';

export let endpointApp = createHono().route('', publicApp);
