import { createClient } from '@lowerdeck/rpc-client';
import type {
  FunctionBayClient,
  FunctionInvokeResponse
} from '../../../function-bay/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createFunctionBayClient = (o: ClientOpts): FunctionBayClient =>
  createClient<FunctionBayClient>(o);

export type { FunctionBayClient, FunctionInvokeResponse };
