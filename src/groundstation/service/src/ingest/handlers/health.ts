import type { IngestHandler } from '../request';

export let pingHandler: IngestHandler = async () => new Response('OK');
