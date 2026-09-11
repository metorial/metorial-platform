import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { IncomingWebhooksTable } from '../../../scenes/callbacks/incomingWebhooksTable';

export let IncomingWebhooksPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <IncomingWebhooksTable instanceId={instance.data.id} />
  ));
};
