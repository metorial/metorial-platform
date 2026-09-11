import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { CallbackEventsTable } from '../../../scenes/callbacks/callbackEventsTable';

export let CallbackEventErrorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <CallbackEventsTable
      instanceId={instance.data.id}
      filters={{ status: 'failed' }}
      emptyState="No callback events have failed. Everything your providers sent was processed."
    />
  ));
};
