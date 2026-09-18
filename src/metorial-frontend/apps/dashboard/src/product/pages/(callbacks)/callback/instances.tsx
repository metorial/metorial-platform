import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useCallbackById, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CallbackInstancesTable } from '../../../scenes/callbacks/callbackInstancesTable';

export let CallbackInstancesPage = () => {
  let instance = useCurrentInstance();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);

  return renderWithLoader({ callback, instance })(({ callback, instance }) => (
    <DetailsTableLayout
      title="Registrations"
      description="The callback automatically registers for events on every integration instance."
    >
      <CallbackInstancesTable
        instanceId={instance.data.id}
        filters={{ callbackId: callback.data.id }}
        emptyState="This callback is not registered for any integration instance yet. Create an instance of the integration to start receiving events."
      />
    </DetailsTableLayout>
  ));
};
