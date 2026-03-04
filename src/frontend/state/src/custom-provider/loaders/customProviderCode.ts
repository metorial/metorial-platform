import { createLoader } from '@metorial/data-hooks';
import { useEffect } from 'react';
import { withAuth } from '../../user';

export let customProviderCodeEditorTokenLoader = createLoader({
  name: 'customProviderCodeEditorToken',
  parents: [],
  fetch: (i: { instanceId: string; customProviderId: string }) =>
    withAuth(sdk =>
      sdk.customProviders.code.getCodeEditorToken(i.instanceId, i.customProviderId)
    ),
  mutators: {}
});

export let useCustomProviderCodeEditorToken = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined
) => {
  let data = customProviderCodeEditorTokenLoader.use(
    instanceId && customProviderId ? { instanceId, customProviderId } : null
  );

  useEffect(() => {
    let expiresAt = data.data?.expiresAt;
    if (!expiresAt) return;

    let expiresAtMs = new Date(expiresAt).getTime();
    let timeUntilExpiry = expiresAtMs - Date.now();

    if (timeUntilExpiry <= 0) {
      data.refetch();
      return;
    }

    let refreshIn = Math.max(5_000, timeUntilExpiry - 30_000);

    let timer = setTimeout(() => {
      data.refetch();
    }, refreshIn);

    return () => clearTimeout(timer);
  }, [data.data?.expiresAt]);

  return {
    ...data
  };
};
