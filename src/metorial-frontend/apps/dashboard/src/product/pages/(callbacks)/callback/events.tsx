import { renderWithLoader } from '@metorial/data-hooks';
import { useCallbackById, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CallbackEventsTable } from '../../../scenes/callbacks/callbackEventsTable';

export let CallbackEventsForCallbackPage = () => {
  let instance = useCurrentInstance();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);

  return renderWithLoader({ callback, instance })(({ callback, instance }) => (
    <CallbackEventsTable
      instanceId={instance.data.id}
      filters={{ callbackId: callback.data.id }}
      emptyState="No events recorded for this callback yet."
    />
  ));
};
