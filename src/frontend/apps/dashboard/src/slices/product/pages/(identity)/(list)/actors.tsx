import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import { showIdentityActorFormModal } from '../../../scenes/identity/actorModal';
import { IdentityActorsTable } from '../../../scenes/identity/actorsTable';
import {
  getIdentityUnavailableError,
  getIdentityUpgrade,
  isIdentityEnabled,
  isPaidIdentityEnabled
} from './_layout';

export let IdentityActorsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Actors"
        description="Manage the actors that can be assigned identities and delegated access."
        actions={
          <Button
            size="2"
            onClick={() => {
              if (!instance.data) return;

              showIdentityActorFormModal({
                instanceId: instance.data.id,
                onCreate: actor =>
                  navigate(
                    Paths.instance.identity.actor(
                      organization.data,
                      project.data,
                      instance.data,
                      actor.id
                    )
                  )
              });
            }}
          >
            Create Actor
          </Button>
        }
      />

      {renderWithLoader({ instance, flags })(({ instance, flags }) => (
        <>
          {!isIdentityEnabled(flags.data.flags) ? (
            getIdentityUnavailableError()
          ) : !isPaidIdentityEnabled(flags.data.flags) ? (
            getIdentityUpgrade()
          ) : (
            <IdentityActorsTable instanceId={instance.data.id} />
          )}
        </>
      ))}
    </ContentLayout>
  );
};
