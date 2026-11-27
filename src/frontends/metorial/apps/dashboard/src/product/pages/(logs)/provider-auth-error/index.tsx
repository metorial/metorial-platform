import { useParams } from 'react-router-dom';
import { ProviderAuthErrorGroupScene } from '../../../scenes/providerAuthErrors/groupScene';

export let ProviderAuthErrorPage = () => {
  let { providerAuthErrorId } = useParams();

  if (!providerAuthErrorId) return null;

  return <ProviderAuthErrorGroupScene errorGroupId={providerAuthErrorId} />;
};
