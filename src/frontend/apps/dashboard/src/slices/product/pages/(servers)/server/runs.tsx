import { useCurrentInstance, useServer } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let ServerRunsPage = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  return null;
};
