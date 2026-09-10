import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { CallbackEventsTable } from '../../../scenes/callbacks/callbackEventsTable';

export let CallbackEventsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <CallbackEventsTable instanceId={instance.data.id} />
  ));
};
