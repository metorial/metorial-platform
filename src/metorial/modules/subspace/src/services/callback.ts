import { Fabric } from '@metorial/fabric';
import { deriveBoundRpcSignatureToken } from '@lowerdeck/rpc-signature';
import type { Instance, OrganizationActor } from '@metorial/db';
import { createSubspaceCallbackSecurityClient } from '@metorial-platform-systems/subspace-client';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { env } from '../env';
import { getActorForSubspace, getTenantForSubspace, subspace } from '../subspace';

type SecurityOwner = {
  instance: Instance;
  callbackId: string;
  callbackInstanceId: string;
  organizationActor: OrganizationActor;
  requestId: string;
  requestIp?: string;
  requestUserAgent?: string;
};

let callCallbackSecurity = async <T>(
  input: SecurityOwner,
  call: (
    client: ReturnType<typeof createSubspaceCallbackSecurityClient>,
    owner: {
      tenantId: string;
      environmentId: string;
      callbackId: string;
      callbackInstanceId: string;
    }
  ) => Promise<T>
) => {
  let { tenant, environmentId, solution } = await getTenantForSubspace(input.instance);
  let actor = await getActorForSubspace(tenant, input.organizationActor);
  if (!actor) throw new Error('Subspace actor could not be resolved');

  let context = Buffer.from(
    JSON.stringify({
      version: 1,
      audience: 'subspace_callback_security',
      serviceActorId: 'metorial_core',
      trustedActorId: actor.id,
      sourceRequestId: input.requestId,
      sourceRequestIp: input.requestIp,
      sourceRequestUserAgent: input.requestUserAgent
    })
  ).toString('base64url');
  let secret = await deriveBoundRpcSignatureToken(
    env.subspace.SUBSPACE_CORE_RPC_TOKEN_CURRENT,
    context
  );
  let client = createSubspaceCallbackSecurityClient({
    endpoint: env.subspace.SUBSPACE_CALLBACK_SECURITY_URL,
    disableBatching: true,
    getHeaders: () => ({
      'Subspace-Solution-Id': solution.id,
      'metorial-core-callback-security-context': context,
      'metorial-core-callback-security-key-id': 'current'
    }),
    getSignatureToken: () => secret
  });

  return call(client, {
    tenantId: tenant.id,
    environmentId,
    callbackId: input.callbackId,
    callbackInstanceId: input.callbackInstanceId
  });
};

export let subspaceCallbackService = createSubspaceService(
  subspace.callback,
  ['get', 'list', 'create', 'update', 'sendDashboardTestEvent', 'archive'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback.created:before', eventBase);

      let callback = await inner.create(...params);

      await Fabric.fire('provider.callback.created:after', {
        ...eventBase,
        callback
      });

      return callback;
    },
    archive: async (...params: Parameters<typeof inner.archive>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback.archived:before', eventBase);

      let callback = await inner.archive(...params);

      await Fabric.fire('provider.callback.archived:after', {
        ...eventBase,
        callback
      });

      return callback;
    },
    createReceiverPathSecret: async (input: SecurityOwner) =>
      callCallbackSecurity(input, (client, owner) =>
        client.callbackSecurity.createReceiverPathSecret(owner)
      ),
    rotateReceiverPathSecret: async (input: SecurityOwner & { graceMs?: number }) =>
      callCallbackSecurity(input, (client, owner) =>
        client.callbackSecurity.rotateReceiverPathSecret({
          ...owner,
          graceMs: input.graceMs
        })
      ),
    revokeReceiverPathSecret: async (input: SecurityOwner & { secretId: string }) =>
      callCallbackSecurity(input, (client, owner) =>
        client.callbackSecurity.revokeReceiverPathSecret({
          ...owner,
          secretId: input.secretId
        })
      ),
    revokeAllReceiverPathSecrets: async (input: SecurityOwner) =>
      callCallbackSecurity(input, (client, owner) =>
        client.callbackSecurity.revokeAllReceiverPathSecrets(owner)
      ),
    consumeReceiverPathSecretReceipt: async (
      input: SecurityOwner & { receiptId: string; receiptToken: string }
    ) =>
      callCallbackSecurity(input, (client, owner) =>
        client.callbackSecurity.consumeReceiverPathSecretReceipt({
          ...owner,
          receiptId: input.receiptId,
          receiptToken: input.receiptToken
        })
      )
  })
);

export type SubspaceCallback = Awaited<ReturnType<typeof subspace.callback.get>>;
