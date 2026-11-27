import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ChatConnectionsGrid } from '../../../scenes/chat/connectionsGrid';

export let ChatConnectionsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <ChatConnectionsGrid instanceId={instance.data.id} />
  ));
};
