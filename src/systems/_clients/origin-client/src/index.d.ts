import { createClient } from '@lowerdeck/rpc-client';
import type { OriginClient } from '../../../origin/apps/service/src/controllers';

export declare let createOriginClient: (
  o: Parameters<typeof createClient>[0]
) => OriginClient;
