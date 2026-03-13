import { renderWithLoader } from '@metorial/data-hooks';
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

  return renderWithLoader({ instance, organization, project, actor })(
    ({ instance, organization, project, actor }) => (
      <ContentLayout>
        <PageHeader
          title={actor.data.name}
          description={actor.data.description ?? undefined}
          actions={
            <Button
              size="2"
              onClick={() =>
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
                })
              }
            >
              Create Identity
            </Button>
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
              label: actor.data.name,
              href: Paths.instance.identity.actor(
                organization.data,
                project.data,
                instance.data,
                actor.data.id
              )
            }
          ]}
        />

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
      </ContentLayout>
    )
  );
};
