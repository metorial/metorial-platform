import { useParams } from 'react-router-dom';
import { ProviderRunsTable } from '../../../scenes/providerRun/table';

export let ProviderSessionRunsPage = () => {
  let { sessionId } = useParams();

  return <ProviderRunsTable sessionId={sessionId} />;
};
