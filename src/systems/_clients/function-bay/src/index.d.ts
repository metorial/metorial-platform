import { createClient } from '@lowerdeck/rpc-client';
import type { FunctionBayClient } from '../../../function-bay/service/src/controllers';

export declare let createFunctionBayClient: (
  o: Parameters<typeof createClient>[0]
) => FunctionBayClient;
