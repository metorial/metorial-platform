import { createApp } from './server';
import { FileStorage, S3Storage } from './storage';

let token = process.env.WARP_CACHE_TOKEN;
let team = process.env.WARP_CACHE_TEAM;
if (!token || !team) throw new Error('WARP_CACHE_TOKEN and WARP_CACHE_TEAM are required');
let port = Number(process.env.WARP_CACHE_PORT || 8787);
let storage = process.env.WARP_CACHE_DIRECTORY
  ? new FileStorage(process.env.WARP_CACHE_DIRECTORY)
  : new S3Storage(process.env.WARP_CACHE_BUCKET || '', process.env.AWS_REGION || 'us-east-1');

Bun.serve({ port, fetch: createApp({ storage, token, team }) });
