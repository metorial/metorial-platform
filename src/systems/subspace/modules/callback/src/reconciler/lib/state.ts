import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db } from '@metorial-subspace/db';
import { getTenantForSlates } from '@metorial-subspace/provider-slates/src/client';

export let TRIGGER_PAGE_SIZE = 100;
export let REGISTRATION_PAGE_SIZE = 100;

export let callbackInclude = {
  tenant: true,
  providerDeployment: {
    include: {
      provider: {
        include: {
          type: true
        }
      }
    }
  },
  callbackDestinationLinks: {
    include: {
      callbackDestination: true
    }
  },
  callbackProviderTriggers: {
    include: {
      providerTrigger: true
    }
  }
};

export let pairInclude = {
  providerDeploymentVersion: {
    include: {
      deployment: true
    }
  },
  providerConfigVersion: {
    include: {
      slateInstance: true
    }
  },
  providerAuthConfigVersion: {
    include: {
      slateAuthConfig: true
    }
  }
};

let loadCallbackUncached = async (callbackId: string) =>
  db.callback.findFirst({
    where: { id: callbackId },
    include: callbackInclude
  });

let loadCallbackCached = createLocallyCachedFunction({
  getHash: (callbackId: string) => callbackId,
  ttlSeconds: 5,
  provider: loadCallbackUncached
});

export let loadCallback = async (callbackId: string) => {
  let callback = await loadCallbackCached(callbackId);
  if (!callback) callback = await loadCallbackUncached(callbackId);
  return callback;
};

let loadCallbackInstanceUncached = async (callbackInstanceId: string) =>
  db.callbackInstance.findFirst({
    where: { id: callbackInstanceId },
    include: {
      callback: {
        include: callbackInclude
      },
      providerDeploymentConfigPair: {
        include: pairInclude
      },
      activeRegistration: true
    }
  });

let loadCallbackInstanceCached = createLocallyCachedFunction({
  getHash: (callbackInstanceId: string) => callbackInstanceId,
  ttlSeconds: 5,
  provider: loadCallbackInstanceUncached
});

export let loadCallbackInstance = async (callbackInstanceId: string) => {
  let callbackInstance = await loadCallbackInstanceCached(callbackInstanceId);
  if (!callbackInstance) callbackInstance = await loadCallbackInstanceUncached(callbackInstanceId);
  return callbackInstance;
};

export let getTenantForSlatesCached = createLocallyCachedFunction({
  getHash: (tenant: { oid: bigint }) => tenant.oid.toString(),
  ttlSeconds: 60,
  provider: getTenantForSlates
});

export let isCallbackSupported = (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) =>
  callback.status === 'active' &&
  callback.providerDeployment.provider.type.attributes.backend === 'slates' &&
  callback.providerDeployment.provider.type.attributes.triggers.status === 'enabled';

export let getActiveDestinationIds = (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) =>
  callback.callbackDestinationLinks
    .filter(link => link.callbackDestination.status === 'active')
    .map(link => link.callbackDestination.slateTriggerDestinationId);
