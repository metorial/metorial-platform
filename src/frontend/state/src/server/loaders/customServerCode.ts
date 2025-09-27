import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let customServerCodeEditorTokenLoader = createLoader({
  name: 'customServerCodeEditorToken',
  parents: [],
  fetch: (i: { instanceId: string; customServerId: string }) =>
    withAuth(sdk => sdk.customServers.code.getCodeEditorToken(i.instanceId, i.customServerId)),
  mutators: {}
});

export let useCustomServerCodeEditorToken = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined
) => {
  let data = customServerCodeEditorTokenLoader.use(
    instanceId && customServerId ? { instanceId, customServerId } : null
  );

  return {
    ...data
  };
};
