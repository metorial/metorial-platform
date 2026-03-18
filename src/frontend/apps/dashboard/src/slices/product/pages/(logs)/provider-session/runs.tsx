import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/providerRun/table';

export let ProviderSessionRunsPage = () => {
  let { sessionId } = useParams();

  return <ServerRunsTable sessionId={sessionId} />;
};
