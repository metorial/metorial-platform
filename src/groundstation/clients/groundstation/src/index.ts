import { createClient } from '@lowerdeck/rpc-client';
import type { GroundstationClient } from '../../../service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createGroundstationClient = (o: ClientOpts): GroundstationClient =>
  createClient<GroundstationClient>(o);
