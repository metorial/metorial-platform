import { createClient } from '@lowerdeck/rpc-client';
import type { InternalClient } from '../../../services/auth-core/service/src/apis/internal';

type ClientOpts = Parameters<typeof createClient>[0];

export let createAresInternalClient = (o: ClientOpts): InternalClient =>
  createClient<InternalClient>(o);

export type {
  AresSyncEvent,
  AresSyncEventType
} from '../../../services/auth-core/service/src/lib/syncEvents';

export { parseAresSyncEvent, verifyAresSignature } from './syncEvents';
