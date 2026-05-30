import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicComponent } from '@metorial/dynamic-component';
import { getConfig } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useLastUsedEnclaves,
  useNetworks
} from '@metorial/state';
import { Attributes, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiArrowRightSLine } from '@remixicon/react';
import { EmptyText, EnclavesTable } from './_common';
import { getDisplayedNetworkPublicIp, NetworkManagedPage, useNetworkManagementAccess } from './_gate';

type NetworkDiagramProps = {
  ipAddress: string;
  region: string;
  apiHost: string;
};

let NetworkDiagram = dynamicComponent<[NetworkDiagramProps]>(() =>
  import('./_diagram').then(c => c.NetworkDiagram)
);

export let SecurityOverviewPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let networks = useNetworks(instance.data?.id, { limit: 1 });
  let lastUsedEnclaves = useLastUsedEnclaves(instance.data?.id, { limit: 8 });
  let apiHost = new URL(getConfig().publicApiUrl).host;
  let { hasPublicIpAccess } = useNetworkManagementAccess();

  return (
    <ContentLayout>
      <PageHeader
        title="Security"
        description="Review your Metorial Magic Network, firewall options, and recent network activity."
      />

      <NetworkManagedPage>
        {renderWithLoader({ networks, lastUsedEnclaves })(({ networks, lastUsedEnclaves }) => {
          let networkPublicIp = networks.data.items[0]?.publicIps[0];
          let displayedPublicIp = getDisplayedNetworkPublicIp(
            networkPublicIp?.ip,
            hasPublicIpAccess
          );

          return (
            <>
              <Attributes
                itemWidth="300px"
                attributes={[
                  {
                    label: 'Project',
                    content: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {organization.data?.name ?? 'Organization'}
                        <RiArrowRightSLine size={14} />
                        {project.data?.name ?? 'Project'}
                      </span>
                    )
                  },
                  {
                    label: 'Public IP',
                    content: displayedPublicIp
                  },
                  {
                    label: 'Region',
                    content: networkPublicIp?.region ?? '-'
                  }
                ]}
              />

              <Spacer size={20} />

              {networkPublicIp && (
                <>
                  <NetworkDiagram
                    ipAddress={displayedPublicIp}
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
      </NetworkManagedPage>
    </ContentLayout>
  );
};
