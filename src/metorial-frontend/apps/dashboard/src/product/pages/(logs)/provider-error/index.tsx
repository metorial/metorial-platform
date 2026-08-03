import { useParams } from 'react-router-dom';
import { ProviderErrorTracingScene } from '../../../scenes/sessionTracing/providerErrorScene';

export let ProviderErrorPage = () => {
  let { providerErrorId } = useParams();

  if (!providerErrorId) return null;

  return <ProviderErrorTracingScene errorGroupId={providerErrorId} />;
};
