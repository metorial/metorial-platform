import { createLoader } from '@metorial/data-hooks';
import { useEffect } from 'react';
import { withAuth } from '../../user';

export let customServerCodeEditorTokenLoader = createLoader({
  name: 'customServerCodeEditorToken',
  parents: [],
  fetch: (i: { instanceId: string; customServerId: string }) =>
    withAuth(sdk =>
      sdk.customProviders.code.getCodeEditorToken(i.instanceId, i.customServerId)
    ),
  mutators: {}
});

export let useCustomServerCodeEditorToken = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined
) => {
  let data = customServerCodeEditorTokenLoader.use(
    instanceId && customServerId ? { instanceId, customServerId } : null
  );

  useEffect(() => {
    let expiresAt = data.data?.expiresAt;
    if (!expiresAt) return;

    let expiresAtMs =
      expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt as any).getTime();
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
