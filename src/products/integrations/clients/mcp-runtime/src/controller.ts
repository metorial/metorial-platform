import { createClient } from '@lowerdeck/rpc-client';
import type { ShuttleClient } from '../../../services/mcp-runtime/apis/internal/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createShuttleClient = (o: ClientOpts): ShuttleClient =>
  createClient<ShuttleClient>(o);
