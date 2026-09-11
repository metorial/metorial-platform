import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeaderSection } from '@metorial/layout';
import {
  useAllCallbackInstances,
  useCallbackById,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Callout, RenderDate, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { CallbackSyncBadge } from '../../../scenes/callbacks/shared';

export let CallbackInstancesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);
  let callbackInstances = useAllCallbackInstances(instance.data?.id, {
    callbackId: callbackId ?? undefined
  });

  return renderWithLoader({ callback, callbackInstances, instance })(
    ({ callbackInstances, instance }) => (
      <PageHeaderSection
        title="Registrations"
        description="The callback automatically registers for events on every integration instance. Each registration is listed below."
      >
        {callbackInstances.data.length ? (
          <Table
            headers={['Integration Instance', 'Registration', 'Updated', 'ID']}
            padding={{ sides: '16px' }}
            data={callbackInstances.data.map(callbackInstance => ({
              href: Paths.instance.integrationInstance(
                organization.data,
                project.data,
                instance.data,
                callbackInstance.integrationInstanceId
              ),
              data: [
                <ID key="instance" id={callbackInstance.integrationInstanceId} copy={false} />,
                <CallbackSyncBadge key="sync" sync={callbackInstance.sync} />,
                <RenderDate key="updated" date={callbackInstance.updatedAt} />,
                <ID key="id" id={callbackInstance.id} copy={false} />
              ]
            }))}
          />
        ) : (
          <Callout color="orange">
            <span>
              This callback is not registered for any integration instance yet. Create an
              instance of the integration to start receiving events.
            </span>
          </Callout>
        )}

        {callbackInstances.data.some(
          callbackInstance => callbackInstance.sync.status === 'failed'
        ) ? (
          <Text size="2" color="gray600">
            Some registrations failed. Open the integration instance to see the provider error.
          </Text>
        ) : null}
      </PageHeaderSection>
    )
  );
};
