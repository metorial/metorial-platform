import { renderWithLoader } from '@metorial/data-hooks';
import { useConsumer, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { SessionConnectionsTable } from '../../../scenes/logs/sessionConnectionsTable';

export let ConsumerConnectionsPage = () => {
  let instance = useCurrentInstance();
  let { consumerId } = useParams();
  let consumer = useConsumer(instance.data?.id, consumerId);

  return renderWithLoader({ instance, consumer })(({ instance, consumer }) => (
    <SessionConnectionsTable
      instanceId={instance.data.id}
      filters={{ consumerId: consumer.data.id }}
    />
  ));
};
