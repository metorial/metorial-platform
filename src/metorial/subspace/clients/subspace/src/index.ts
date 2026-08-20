import { createClient } from '@lowerdeck/rpc-client';
import type {
  SubspaceCallbackSecurityClient,
  SubspaceControllerClient
} from '../../../apps/controller/src/controllers';

export let createSubspaceControllerClient = (
  o: Parameters<typeof createClient<SubspaceControllerClient>>[0]
): SubspaceControllerClient => createClient<SubspaceControllerClient>(o);

export let createSubspaceCallbackSecurityClient = (
  o: Parameters<typeof createClient<SubspaceCallbackSecurityClient>>[0]
): SubspaceCallbackSecurityClient => createClient<SubspaceCallbackSecurityClient>(o);
