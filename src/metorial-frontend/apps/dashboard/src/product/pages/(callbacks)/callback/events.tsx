import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useCallbackById, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CallbackEventsTable } from '../../../scenes/callbacks/callbackEventsTable';

export let CallbackEventsForCallbackPage = () => {
  let instance = useCurrentInstance();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);

  return renderWithLoader({ callback, instance })(({ callback, instance }) => (
    <DetailsTableLayout
      title="Events"
      description="Provider events recorded for this callback, newest first."
    >
      <CallbackEventsTable
        instanceId={instance.data.id}
        filters={{ callbackId: callback.data.id }}
        emptyState="No events recorded for this callback yet."
      />
    </DetailsTableLayout>
  ));
};
