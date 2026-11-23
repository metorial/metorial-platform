import { createClient } from '@lowerdeck/rpc-client';
import type { AgentTrackingClient } from '../../../services/agent-tracking/apis/internal/src/root';

type ClientOpts = Parameters<typeof createClient>[0];

export let createAgentTrackingClient = (o: ClientOpts): AgentTrackingClient =>
  createClient<AgentTrackingClient>(o);
