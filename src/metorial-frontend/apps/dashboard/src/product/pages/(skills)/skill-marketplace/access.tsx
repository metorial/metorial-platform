import { useCurrentInstance } from '@metorial/state';
import { useParams, useSearchParams } from 'react-router-dom';
import { MarketplaceManagersList } from '../../../scenes/skills/marketplaceManagers';

export let SkillMarketplaceAccessPage = () => {
  let instance = useCurrentInstance();
  let { skillMarketplaceId } = useParams();
  let [searchParams] = useSearchParams();
  let portalId = searchParams.get('portalId') ?? undefined;

  if (!instance.data?.id || !skillMarketplaceId) return null;

  return (
    <MarketplaceManagersList
      instanceId={instance.data.id}
      skillMarketplaceId={skillMarketplaceId}
      portalId={portalId}
    />
  );
};
