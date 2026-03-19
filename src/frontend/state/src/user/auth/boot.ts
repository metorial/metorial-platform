import { MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withDashboardSDK } from '../../sdk';
import { redirectToAuthIfNotAuthenticated } from '../../user/auth/withAuth';

export let bootLoader = createLoader({
  name: 'boot',
  fetch: (i: {}) =>
    redirectToAuthIfNotAuthenticated(
      async (): ReturnType<MetorialDashboardSDK['dashboard']['boot']> => {
        if ((window as any).enterpriseBoot) {
          return await (window as any).enterpriseBoot();
        }

        if ((window as any).enterpriseUserPromise) {
          await (window as any).enterpriseUserPromise;
        }

        return await withDashboardSDK(sdk => sdk.dashboard.boot({}));
      }
    ),
  mutators: {}
});

export let useBoot = () => {
  let boot = bootLoader.use({});
  if ((window as any).filterBoot) return (window as any).filterBoot(boot) as typeof boot;

  return boot;
};

export let getBoot = () => bootLoader.fetchAndReturn({});

export let getInstances = () => getBoot().then(boot => boot.instances);

export let getOrgForInstance = (instanceId: string) =>
  getBoot().then(boot => boot.instances.find(i => i.id === instanceId)?.organization);
