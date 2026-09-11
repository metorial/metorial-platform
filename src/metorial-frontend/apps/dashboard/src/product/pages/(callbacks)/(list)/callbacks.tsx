import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate } from 'react-router-dom';
import { CallbacksTable } from '../../../scenes/callbacks/callbacksTable';

export let CallbacksPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return renderWithLoader({ instance, organization, project })(
    ({ instance, organization, project }) => (
      <CallbacksTable
        instanceId={instance.data.id}
        emptyState={() => (
          <EmptyState
            extra="Callbacks"
            title="Enable callbacks for an integration"
            description="Callbacks let providers notify your application when interesting events happen, like new messages or status changes."
            action={{
              label: 'View Integrations',
              onClick: () =>
                navigate(
                  Paths.instance.integrations(organization.data, project.data, instance.data)
                )
            }}
          />
        )}
      />
    )
  );
};
