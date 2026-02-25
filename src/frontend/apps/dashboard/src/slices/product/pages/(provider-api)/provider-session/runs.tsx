import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/serverRuns/table';

export let ProviderSessionRunsPage = () => {
  let { sessionId } = useParams();

  return <ServerRunsTable sessionId={sessionId} />;
};
