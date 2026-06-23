import { useParams } from 'react-router-dom';
import { ProviderRunsTable } from '../../../scenes/providerRun/table';
import { ProviderSessionContent } from './_content';

export let ProviderSessionRunsPage = () => {
  let { sessionId } = useParams();

  return (
    <ProviderSessionContent>
      <ProviderRunsTable sessionId={sessionId} />
    </ProviderSessionContent>
  );
};
