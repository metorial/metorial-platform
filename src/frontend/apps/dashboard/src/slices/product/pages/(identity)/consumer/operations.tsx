import { renderWithLoader } from '@metorial/data-hooks';
import { useConsumer, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ToolCallsTable } from '../../../scenes/logsTable/toolCallsTable';

export let ConsumerOperationsPage = () => {
  let instance = useCurrentInstance();
  let { consumerId } = useParams();
  let consumer = useConsumer(instance.data?.id, consumerId);

  return renderWithLoader({ instance, consumer })(({ instance, consumer }) => (
    <ToolCallsTable instanceId={instance.data.id} filters={{ consumerId: consumer.data.id }} />
  ));
};
