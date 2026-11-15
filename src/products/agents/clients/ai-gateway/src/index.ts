import { createClient } from '@lowerdeck/rpc-client';
import type { AiGatewayClient } from '../../../services/ai-gateway/apis/internal/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createAiGatewayClient = (o: ClientOpts): AiGatewayClient =>
  createClient<AiGatewayClient>(o);
