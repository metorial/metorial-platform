import type { PublicIngestHandler } from '../request';

export let pingHandler: PublicIngestHandler = async () => new Response('OK');
