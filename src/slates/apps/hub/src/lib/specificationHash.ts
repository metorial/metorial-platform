import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import type { SlateAuthenticationMethod, SlatesAction, SlatesTriggerGroup } from '@slates/proto';

type SlateDocReference = PrismaJson.SlateDocReference;

export let dedupeDiscoveredItems = <T extends { id: string }>(
  items: T[],
  d: {
    entity: string;
    slateId: string;
    versionId: string;
    getKey?: (item: T) => string;
  }
) => {
  let deduped: T[] = [];
  let seen = new Set<string>();
  let duplicateKeys = new Set<string>();

  for (let item of items) {
    let key = d.getKey?.(item) ?? item.id;
    if (seen.has(key)) {
      duplicateKeys.add(key);
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  if (duplicateKeys.size > 0) {
    console.warn(`Filtered duplicate discovered ${d.entity}`, {
      slateId: d.slateId,
      versionId: d.versionId,
      duplicateKeys: [...duplicateKeys]
    });
  }

  return deduped;
};

export let hashDiscoveredProviderInfo = async (d: {
  protocol: string;
  provider: Record<string, any>;
  docs: SlateDocReference[];
}) => await Hash.sha256(canonicalize(d));

export let hashDiscoveredConfigSchema = async (d: {
  schema: Record<string, any>;
  docs: SlateDocReference[];
}) => await Hash.sha256(canonicalize(d));

export let hashDiscoveredAuthMethod = async (method: SlateAuthenticationMethod) =>
  await Hash.sha256(canonicalize(method));

export let hashDiscoveredAction = async (action: SlatesAction) =>
  await Hash.sha256(canonicalize(action));

export let hashDiscoveredTriggerGroup = async (triggerGroup: SlatesTriggerGroup) =>
  await Hash.sha256(canonicalize(triggerGroup));

export let buildDiscoveredSpecificationHashes = async (d: {
  providerInfo: {
    protocol: string;
    provider: Record<string, any>;
    docs: SlateDocReference[];
  };
  configSchema: {
    schema: Record<string, any>;
    docs: SlateDocReference[];
  };
  authMethods: SlateAuthenticationMethod[];
  actions: SlatesAction[];
  triggerGroups: SlatesTriggerGroup[];
}) => {
  let providerInfoHash = await hashDiscoveredProviderInfo(d.providerInfo);
  let configSchemaHash = await hashDiscoveredConfigSchema(d.configSchema);
  let authMethodHashes = await Promise.all(d.authMethods.map(hashDiscoveredAuthMethod));
  let actionHashes = await Promise.all(d.actions.map(hashDiscoveredAction));
  let triggerGroupHashes = await Promise.all(d.triggerGroups.map(hashDiscoveredTriggerGroup));

  let specificationHash = await Hash.sha256(
    canonicalize({
      providerInfoHash,
      configSchemaHash,
      authMethodHashes: [...authMethodHashes].sort(),
      actionHashes: [...actionHashes].sort(),
      triggerGroupHashes: [...triggerGroupHashes].sort()
    })
  );

  return {
    providerInfoHash,
    configSchemaHash,
    authMethodHashes,
    actionHashes,
    triggerGroupHashes,
    specificationHash
  };
};
