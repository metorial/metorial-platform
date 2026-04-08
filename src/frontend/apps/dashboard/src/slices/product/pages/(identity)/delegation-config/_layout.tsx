import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegationConfig
} from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let IdentityDelegationConfigLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { identityDelegationConfigId } = useParams();
  let config = useIdentityDelegationConfig(instance.data?.id, identityDelegationConfigId);

  return (
    <ContentLayout>
      <PageHeader
        title={config.data?.name ?? config.data?.id ?? '...'}
        description={config.data?.description ?? undefined}
        pagination={[
          {
            label: 'Delegation Configs',
            href: Paths.instance.identity.delegationConfigs(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: config.data?.name ?? config.data?.id ?? identityDelegationConfigId ?? '...',
            href: Paths.instance.identity.delegationConfig(
              organization.data,
              project.data,
              instance.data,
              config.data?.id ?? identityDelegationConfigId
            )
          }
        ]}
      />

      {renderWithLoader({ instance, organization, project, config })(() => (
        <Outlet />
      ))}
    </ContentLayout>
  );
};
