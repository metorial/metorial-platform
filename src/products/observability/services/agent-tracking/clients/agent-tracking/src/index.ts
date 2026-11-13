import { createClient } from '@lowerdeck/rpc-client';
import type { AgentTrackingClient } from '../../../apis/internal/src/root';

type ClientOpts = Parameters<typeof createClient>[0];

export let createAgentTrackingClient = (o: ClientOpts): AgentTrackingClient =>
  createClient<AgentTrackingClient>(o);
