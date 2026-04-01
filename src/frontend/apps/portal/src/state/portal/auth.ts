import { createLoader } from '@metorial/data-hooks';
import { getPortalInfo, portalClient, refreshPortalBoot } from './client';

let portalAuthState = createLoader({
  name: 'portalAuth',
  hash: () => 'v2',
  fetch: async (_: {}) => null,
  mutators: {
    startSso: async () => {
      let boot = await getPortalInfo();

      return await portalClient.auth.authenticateWithSsoStart({
        portalId: boot.portal.id
      });
    },

    completeSso: async (input: { portalId: string; code: string; state: string }) => {
      let session = await portalClient.auth.authenticateWithSsoComplete(input);

      await refreshPortalBoot();

      return session;
    }
  }
});

export let usePortalAuth = () => {
  let auth = portalAuthState.use({});

  return {
    ...auth,
    useStartSso: auth.useMutator('startSso'),
    useCompleteSso: auth.useMutator('completeSso')
  };
};
