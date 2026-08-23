import type {
  AdapterIntegration,
  AdapterIntegrationInstance,
  AdapterIntegrationInstanceProvider,
  AdapterIntegrationProvider,
  AdapterIntegrationType,
  Environment,
  Tenant
} from '@metorial-subspace/db';

export type AdapterListenerCause = 'product' | 'integration';

export type AdapterListenerScope = {
  tenant: Tenant;
  environment: Environment;
  cause: AdapterListenerCause;
};

export type AdapterListener = {
  onIntegrationSynced?(
    ctx: AdapterListenerScope & { adapterIntegration: AdapterIntegration }
  ): Promise<void>;

  onIntegrationArchived?(
    ctx: AdapterListenerScope & { adapterIntegration: AdapterIntegration }
  ): Promise<void>;

  onProvidersSynced?(
    ctx: AdapterListenerScope & {
      adapterIntegration: AdapterIntegration;
      providers: AdapterIntegrationProvider[];
    }
  ): Promise<void>;

  onInstanceSynced?(
    ctx: AdapterListenerScope & {
      adapterIntegration: AdapterIntegration;
      adapterInstance: AdapterIntegrationInstance;
    }
  ): Promise<void>;

  onInstanceArchived?(
    ctx: AdapterListenerScope & {
      adapterIntegration: AdapterIntegration;
      adapterInstance: AdapterIntegrationInstance;
    }
  ): Promise<void>;

  onInstanceProvidersSynced?(
    ctx: AdapterListenerScope & {
      adapterIntegration: AdapterIntegration;
      adapterInstance: AdapterIntegrationInstance;
      providers: AdapterIntegrationInstanceProvider[];
    }
  ): Promise<void>;
};

let listeners = new Map<AdapterIntegrationType, AdapterListener>();

export let registerAdapterListener = (
  type: AdapterIntegrationType,
  listener: AdapterListener
) => {
  if (listeners.has(type)) {
    throw new Error(`Adapter listener for type "${type}" is already registered`);
  }
  listeners.set(type, listener);
};

let getListener = (type: AdapterIntegrationType) => listeners.get(type);

export let notifyAdapterProvidersSynced = async (
  ctx: AdapterListenerScope & {
    adapterIntegration: AdapterIntegration;
    providers: AdapterIntegrationProvider[];
  }
) => {
  let listener = getListener(ctx.adapterIntegration.type);
  if (!listener?.onProvidersSynced) return;
  await listener.onProvidersSynced(ctx);
};

export let notifyAdapterInstanceSynced = async (
  ctx: AdapterListenerScope & {
    adapterIntegration: AdapterIntegration;
    adapterInstance: AdapterIntegrationInstance;
  }
) => {
  let listener = getListener(ctx.adapterIntegration.type);
  if (!listener?.onInstanceSynced) return;
  await listener.onInstanceSynced(ctx);
};

export let notifyAdapterInstanceArchived = async (
  ctx: AdapterListenerScope & {
    adapterIntegration: AdapterIntegration;
    adapterInstance: AdapterIntegrationInstance;
  }
) => {
  let listener = getListener(ctx.adapterIntegration.type);
  if (!listener?.onInstanceArchived) return;
  await listener.onInstanceArchived(ctx);
};

export let notifyAdapterInstanceProvidersSynced = async (
  ctx: AdapterListenerScope & {
    adapterIntegration: AdapterIntegration;
    adapterInstance: AdapterIntegrationInstance;
    providers: AdapterIntegrationInstanceProvider[];
  }
) => {
  let listener = getListener(ctx.adapterIntegration.type);
  if (!listener?.onInstanceProvidersSynced) return;
  await listener.onInstanceProvidersSynced(ctx);
};

export let notifyAdapterIntegrationArchived = async (
  ctx: AdapterListenerScope & { adapterIntegration: AdapterIntegration }
) => {
  let listener = getListener(ctx.adapterIntegration.type);
  if (!listener?.onIntegrationArchived) return;
  await listener.onIntegrationArchived(ctx);
};
