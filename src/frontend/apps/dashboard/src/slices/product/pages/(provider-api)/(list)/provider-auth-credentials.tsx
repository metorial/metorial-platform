import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderAuthCredentials,
  useProviderDeployments
} from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';

export let ProviderAuthCredentialsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let credentials = useInstanceProviderAuthCredentials(instance.data?.id);
  let deployments = useProviderDeployments(instance.data?.id);

  let deploymentByProviderId = useMemo(() => {
    let map = new Map<string, { id: string; name: string | null }>();
    for (let d of deployments.data?.items ?? []) {
      if (!map.has(d.providerId)) {
        map.set(d.providerId, { id: d.id, name: d.name });
      }
    }
    return map;
  }, [deployments.data?.items]);

  return renderWithPagination(credentials)(credentials => (
    <>
      <Table
        headers={['Name', 'Provider ID', 'Created']}
        data={credentials.data.items.map(cred => {
          let deployment = deploymentByProviderId.get(cred.providerId);

          return {
            href: deployment
              ? Paths.instance.providerAuthCredential(
                  organization.data as any,
                  project.data as any,
                  instance.data as any,
                  deployment.id,
                  cred.id
                )
              : undefined,
            data: [
              <Text size="2" weight="strong">
                {cred.name ?? (
                  <span style={{ color: theme.colors.gray600 }}>Unnamed</span>
                )}
              </Text>,
              <Text size="2">{cred.providerId}</Text>,
              <RenderDate date={cred.createdAt} />
            ]
          };
        })}
      />

      {credentials.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No auth credentials found.
        </Text>
      )}
    </>
  ));
};
