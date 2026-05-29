import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicComponent } from '@metorial/dynamic-component';
import { getConfig } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useLastUsedEnclaves,
  useNetworks
} from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { EmptyText, EnclavesTable } from './_common';

type NetworkDiagramProps = {
  ipAddress: string;
  region: string;
  apiHost: string;
};

let NetworkDiagram = dynamicComponent<[NetworkDiagramProps]>(() =>
  import('./_diagram').then(c => c.NetworkDiagram)
);

export let SecurityOverviewPage = () => {
  let instance = useCurrentInstance();
  let networks = useNetworks(instance.data?.id, { limit: 1 });
  let lastUsedEnclaves = useLastUsedEnclaves(instance.data?.id, { limit: 8 });
  let apiHost = new URL(getConfig().publicApiUrl).host;

  return (
    <ContentLayout>
      <PageHeader
        title="Security"
        description="Review your Metorial Magic Network, firewall options, and recent network activity."
      />

      {renderWithLoader({ networks, lastUsedEnclaves })(({ networks, lastUsedEnclaves }) => {
        let networkPublicIp = networks.data.items[0]?.publicIps[0];

        return (
          <>
            {networkPublicIp && (
              <>
                <NetworkDiagram
                  ipAddress={networkPublicIp.ip}
                  region={networkPublicIp.region}
                  apiHost={apiHost}
                />

                <Spacer size={20} />
              </>
            )}

            <Box
              title="Recently Used Enclaves"
              description="Enclaves that were recently used to run providers."
            >
              {lastUsedEnclaves.data.items.length > 0 ? (
                <EnclavesTable enclaves={lastUsedEnclaves.data.items} />
              ) : (
                <EmptyText>No recently used enclaves.</EmptyText>
              )}
            </Box>
          </>
        );
      })}
    </ContentLayout>
  );
};
