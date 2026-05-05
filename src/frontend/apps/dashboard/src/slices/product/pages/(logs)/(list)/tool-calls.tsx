import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ToolCallsTable } from '../../../scenes/logs/toolCallsTable';

export let ToolCallsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <ToolCallsTable instanceId={instance.data.id} />
  ));
};
