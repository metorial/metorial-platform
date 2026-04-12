import { createClient } from '@lowerdeck/rpc-client';
import type { ForgeClient } from '../../../forge/service/src/controllers';

export declare let createForgeClient: (o: Parameters<typeof createClient>[0]) => ForgeClient;
