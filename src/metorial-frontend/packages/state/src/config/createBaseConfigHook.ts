import { applyPatch, type JsonValue, type PatchOperation } from '@lowerdeck/patch';
import { useMemo } from 'react';
import { useCurrentOrganization } from '../organization/current';
import { useOrganizationConfig } from '../organization/loaders/organizationConfig';
import {
  organizationConfigDefaults,
  type OrganizationConfigKey,
  type OrganizationConfigs
} from './generated/organizationConfigs';
import { configPendingStore, usePendingBatches } from './pendingStore';
import type { ConfigHook } from './types';
import { enqueueConfigWrite } from './writeQueue';

export let createBaseConfigHook =
  <K extends OrganizationConfigKey>(selector: K): ConfigHook<OrganizationConfigs[K]> =>
  options => {
    let organization = useCurrentOrganization();
    let organizationId = options?.enabled === false ? null : (organization.data?.id ?? null);

    let config = useOrganizationConfig(organizationId, selector);
    let patchMutator = config.usePatchMutator();

    let key = organizationId ? `${organizationId}:${selector}` : null;
    let pending = usePendingBatches(key);

    let serverValue = (config.data?.value ??
      organizationConfigDefaults[selector]) as OrganizationConfigs[K];

    let value = useMemo(() => {
      if (!pending.length) return serverValue;

      try {
        return applyPatch(
          serverValue as unknown as JsonValue,
          pending.flatMap(batch => batch.operations)
        ) as unknown as OrganizationConfigs[K];
      } catch {
        return serverValue;
      }
    }, [serverValue, pending]);

    let patch = async (operations: PatchOperation[]) => {
      if (!key || !operations.length) return false;

      let batch = configPendingStore.add(key, operations);
      let [result] = await enqueueConfigWrite(key, () => patchMutator.mutate({ operations }));
      configPendingStore.remove(key, batch.id);

      return !!result;
    };

    return {
      value,
      isLoading: config.isLoading,
      isReady: !!config.data,
      error: config.error,
      patch,
      set: next => patch([{ op: 'set', path: [], value: next as unknown as JsonValue }])
    };
  };
