import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags
} from '@metorial/state';
import { Button, Error, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Upgrade } from '../../../../../components/emptyState';
import { showIdentityDelegationConfigFormModal } from '../../../scenes/identity/delegationConfigModal';

export let isIdentityEnabled = (flags: Record<string, boolean> | undefined) =>
  !!flags?.['identity-management'];

export let isPaidIdentityEnabled = (flags: Record<string, boolean> | undefined) =>
  !!flags?.['paid-identity'];

export let getIdentityUpgrade = () => (
  <Upgrade
    title="Identity Management"
    description="Manage identity actors, identities, delegations, and delegation policies once this instance is upgraded."
  />
);

export let getIdentityUnavailableError = () => (
  <Error style={{ marginTop: 20 }}>
    Identity management is not enabled for this instance.
  </Error>
);

export let IdentityListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let pathname = useLocation().pathname;
  let navigate = useNavigate();

  let activeTab = pathname.endsWith('/delegation-configs')
    ? 'delegation-configs'
    : pathname.endsWith('/delegations')
      ? 'delegations'
      : 'actors';

  return renderWithLoader({ instance, organization, project, flags })(
    ({ instance, organization, project, flags }) => (
      <ContentLayout>
        <PageHeader
          title="Identity"
          description="Manage identities and identity delegation to enable secure and flexible access control for agents and humans."
          actions={
            activeTab === 'delegation-configs' ? (
              <Button
                size="2"
                onClick={() =>
                  showIdentityDelegationConfigFormModal({
                    instanceId: instance.data.id,
                    onCreate: config =>
                      navigate(
                        Paths.instance.identity.delegationConfig(
                          organization.data,
                          project.data,
                          instance.data,
                          config.id
                        )
                      )
                  })
                }
              >
                Create Config
              </Button>
            ) : undefined
          }
        />

        <LinkTabs
          current={pathname}
          links={[
            {
              label: 'Identities',
              to: Paths.instance.identity.identities(
                organization.data,
                project.data,
                instance.data
              )
            },
            {
              label: 'Delegations',
              to: Paths.instance.identity.delegations(
                organization.data,
                project.data,
                instance.data
              )
            },
            {
              label: 'Delegation Configs',
              to: Paths.instance.identity.delegationConfigs(
                organization.data,
                project.data,
                instance.data
              )
            }
          ]}
        />

        {!isIdentityEnabled(flags.data.flags) ? (
          getIdentityUnavailableError()
        ) : !isPaidIdentityEnabled(flags.data.flags) ? (
          getIdentityUpgrade()
        ) : (
          <Outlet />
        )}
      </ContentLayout>
    )
  );
};
