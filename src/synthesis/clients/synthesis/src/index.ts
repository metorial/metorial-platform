import { createClient } from '@lowerdeck/rpc-client';
import type { SynthesisClient } from '../../../service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSynthesisClient = (o: ClientOpts): SynthesisClient =>
  createClient<SynthesisClient>(o);
