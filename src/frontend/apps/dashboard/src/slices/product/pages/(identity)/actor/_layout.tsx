import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityActor
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showIdentityFormModal } from '../../../scenes/identity/identityModal';

export let IdentityActorLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let location = useLocation();
  let navigate = useNavigate();
  let { identityActorId } = useParams();
  let actor = useIdentityActor(instance.data?.id, identityActorId);

  return (
    <ContentLayout>
      <PageHeader
        title={actor.data?.name ?? '...'}
        description={actor.data?.description ?? undefined}
        actions={
          actor.data ? (
            <Button
              size="2"
              onClick={() => {
                if (!instance.data || !actor.data) return;

                showIdentityFormModal({
                  instanceId: instance.data.id,
                  actorId: actor.data.id,
                  actorName: actor.data.name,
                  onCreate: identity =>
                    navigate(
                      Paths.instance.identity.identity(
                        organization.data,
                        project.data,
                        instance.data,
                        identity.id
                      )
                    )
                });
              }}
            >
              Create Identity
            </Button>
          ) : undefined
        }
        pagination={[
          {
            label: 'Identity Actors',
            href: Paths.instance.identity.actors(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: actor.data?.name ?? identityActorId ?? '...',
            href: Paths.instance.identity.actor(
              organization.data,
              project.data,
              instance.data,
              actor.data?.id ?? identityActorId
            )
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ instance, organization, project, actor })(
          ({ instance, organization, project, actor }) => (
            <>
              <LinkTabs
                current={location.pathname}
                links={[
                  {
                    label: 'Overview',
                    to: Paths.instance.identity.actor(
                      organization.data,
                      project.data,
                      instance.data,
                      actor.data.id
                    )
                  },
                  {
                    label: 'Operations',
                    to: Paths.instance.identity.actor(
                      organization.data,
                      project.data,
                      instance.data,
                      actor.data.id,
                      'operations'
                    )
                  },
                  {
                    label: 'Connections',
                    to: Paths.instance.identity.actor(
                      organization.data,
                      project.data,
                      instance.data,
                      actor.data.id,
                      'connections'
                    )
                  },
                  {
                    label: 'Delegations',
                    to: Paths.instance.identity.actor(
                      organization.data,
                      project.data,
                      instance.data,
                      actor.data.id,
                      'delegations'
                    )
                  },
                  {
                    label: 'Settings',
                    to: Paths.instance.identity.actor(
                      organization.data,
                      project.data,
                      instance.data,
                      actor.data.id,
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
