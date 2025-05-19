import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerImplementationsTable } from '../../../scenes/server-implementations/table';

export let ServerServerImplementationsPage = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  return renderWithLoader({ server })(({ server }) => (
    <ServerImplementationsTable serverIds={[server.data.id]} />
  ));
};
