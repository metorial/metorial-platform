import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentity
} from '@metorial/state';
import { Button, LinkTabs, Menu } from '@metorial/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useIdentityPaths } from '../../../lib/identityPaths';
import { showIdentityDelegationFormModal } from '../../../scenes/identity/delegationModal';
import { showIdentityDelegationRequestFormModal } from '../../../scenes/identity/delegationRequestModal';

export let IdentityLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let identityPaths = useIdentityPaths();
  let { identityId } = useParams();
  let _identity = useIdentity(instance.data?.id, identityId);
  let pathname = useLocation().pathname;
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title={_identity.data?.name ?? _identity.data?.id ?? '...'}
        description={_identity.data?.description ?? undefined}
        actions={
          _identity.data ? (
            <Menu
              label="Delegate"
              items={[
                {
                  id: 'delegation',
                  label: 'Create Delegation',
                  description: 'Grant delegated access to another actor.'
                },
                {
                  id: 'delegation-request',
                  label: 'Create Delegation Request',
                  description: 'Create a delegation request that can later be approved.'
                }
              ]}
              onItemClick={itemId => {
                if (!_identity.data || !instance.data || !organization.data || !project.data)
                  return;

                if (itemId === 'delegation') {
                  showIdentityDelegationFormModal({
                    instanceId: instance.data.id,
                    identityId: _identity.data.id,
                    identityName: _identity.data.name,
                    onCreate: delegation =>
                      navigate(
                        Paths.organization.instance.identity.delegation(
                          organization.data,
                          project.data,
                          instance.data,
                          delegation.id
                        )
                      )
                  });
                  return;
                }

                showIdentityDelegationRequestFormModal({
                  instanceId: instance.data.id,
                  identityId: _identity.data.id,
                  identityName: _identity.data.name,
                  onCreate: request =>
                    navigate(
                      Paths.organization.instance.identity.delegation(
                        organization.data,
                        project.data,
                        instance.data,
                        request.delegation.id
                      )
                    )
                });
              }}
            >
              <Button size="2">Delegate</Button>
            </Menu>
          ) : undefined
        }
        pagination={[
          {
            label: 'Identities',
            href: identityPaths.identities(organization.data, project.data, instance.data)
          },
          {
            label: _identity.data?.name ?? _identity.data?.id ?? identityId ?? '...',
            href: identityPaths.identity(
              organization.data,
              project.data,
              instance.data,
              _identity.data?.id ?? identityId
            )
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ instance, organization, project, identity: _identity })(
          ({ instance, organization, project, identity }) => (
            <>
              <LinkTabs
                current={pathname}
                links={[
                  {
                    label: 'Overview',
                    to: identityPaths.identity(
                      organization.data,
                      project.data,
                      instance.data,
                      identity.data.id
                    )
                  },
                  {
                    label: 'Delegations',
                    to: identityPaths.identity(
                      organization.data,
                      project.data,
                      instance.data,
                      identity.data.id,
                      'delegations'
                    )
                  },
                  {
                    label: 'Delegation Requests',
                    to: identityPaths.identity(
                      organization.data,
                      project.data,
                      instance.data,
                      identity.data.id,
                      'delegation-requests'
                    )
                  },
                  {
                    label: 'Settings',
                    to: identityPaths.identity(
                      organization.data,
                      project.data,
                      instance.data,
                      identity.data.id,
                      'settings'
                    )
                  }
                ]}
              />

              <Outlet />
            </>
          )
        )}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
