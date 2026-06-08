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
import { showConsumerFormModal } from '../../../scenes/consumer/modal';
import { ConsumersTable } from '../../../scenes/consumer/table';
import {
  getIdentityUnavailableError,
  getIdentityUpgrade,
  isIdentityEnabled,
  isPaidIdentityEnabled
} from './_layout';

export let ConsumersPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Accounts"
        description="Manage the access that accounts have across Metorial."
        actions={
          <Button
            size="2"
            onClick={() => {
              if (!instance.data) return;

              showConsumerFormModal({
                instanceId: instance.data.id,
                onCreate: consumer =>
                  navigate(
                    Paths.instance.identity.consumer(
                      organization.data,
                      project.data,
                      instance.data,
                      consumer.id
                    )
                  )
              });
            }}
          >
            Create Account
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
            <ConsumersTable instanceId={instance.data.id} />
          )}
        </>
      ))}
    </ContentLayout>
  );
};
