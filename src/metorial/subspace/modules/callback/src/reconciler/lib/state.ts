import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db } from '@metorial-subspace/db';
import { getTenantForSlates } from '@metorial-subspace/provider-slates/src/client';

export let TRIGGER_PAGE_SIZE = 100;
export let REGISTRATION_PAGE_SIZE = 100;

export let callbackInclude = {
  tenant: true,
  environment: true,
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
  },
  callbackConfig: {
    include: {
      currentVersion: {
        include: { slateCallbackConfig: true }
      }
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
      config: true,
      slateInstance: true
    }
  },
  providerAuthConfigVersion: {
    include: {
      authConfig: true,
      slateAuthConfig: true
    }
  }
};

let loadCallbackUncached = async (callbackId: string) =>
  db.callback.findFirst({
    where: { id: callbackId },
    include: callbackInclude
  });

export let loadFreshCallback = loadCallbackUncached;

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
      integrationInstance: true,
      integrationInstanceProvider: true,
      callback: {
        include: callbackInclude
      },
      providerDeploymentConfigPair: {
        include: pairInclude
      }
    }
  });

export let loadFreshCallbackInstance = loadCallbackInstanceUncached;

let loadCallbackInstanceCached = createLocallyCachedFunction({
  getHash: (callbackInstanceId: string) => callbackInstanceId,
  ttlSeconds: 5,
  provider: loadCallbackInstanceUncached
});

export let loadCallbackInstance = async (callbackInstanceId: string) => {
  let callbackInstance = await loadCallbackInstanceCached(callbackInstanceId);
  if (!callbackInstance)
    callbackInstance = await loadCallbackInstanceUncached(callbackInstanceId);
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

export let isPairUsable = (
  pair: NonNullable<
    Awaited<ReturnType<typeof loadCallbackInstance>>
  >['providerDeploymentConfigPair']
) =>
  pair.providerDeploymentVersion.deployment.status === 'active' &&
  pair.providerConfigVersion.config.status === 'active' &&
  (!pair.providerAuthConfigVersion ||
    pair.providerAuthConfigVersion.authConfig.status === 'active');
