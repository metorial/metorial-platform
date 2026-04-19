import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviders,
  useSession
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ProviderSessionContent } from './_content';

export let ProviderSessionProvidersPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <ProviderSessionProviders
      organization={organization.data}
      project={project.data}
      instance={instance.data}
      session={session.data}
    />
  ));
};

export let ProviderSessionProviders = ({
  organization,
  project,
  instance,
  session
}: {
  organization: ReturnType<typeof useCurrentOrganization>['data'];
  project: ReturnType<typeof useCurrentProject>['data'];
  instance: ReturnType<typeof useCurrentInstance>['data'];
  session: DashboardInstanceSessionsGetOutput;
}) => {
  let providerIds = useMemo(
    () =>
      Array.from(
        new Set((session.providers ?? []).map(dep => dep.providerId).filter(Boolean))
      ),
    [session.providers]
  );
  let providers = useProviders(instance?.id, { id: providerIds });

  return (
    <ProviderSessionContent>
      {renderWithLoader({ providers })(({ providers }) => {
        let deployments = session.providers ?? [];
        let providerNameMap = new Map<string, string>();
        for (let provider of providers.data?.items ?? []) {
          if (provider.id && provider.name) providerNameMap.set(provider.id, provider.name);
        }

        return (
          <>
            <Table
              headers={['Deployment', 'Provider', 'Created']}
              data={deployments.map(dep => ({
                data: [
                  <Text size="2" weight="strong">
                    {dep.deployment?.name ?? 'Unnamed'}
                  </Text>,
                  <Text size="2">
                    {providerNameMap.get(dep.providerId) ?? dep.providerId}
                  </Text>,
                  <RenderDate date={session.createdAt} />
                ],
                href: dep.deployment?.id
                  ? Paths.instance.providerDeployment(
                      organization,
                      project,
                      instance,
                      dep.deployment.id
                    )
                  : undefined
              }))}
            />

            {deployments.length === 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                No provider deployments in this session.
              </Text>
            )}
          </>
        );
      })}
    </ProviderSessionContent>
  );
};
