import { useParams } from 'react-router-dom';
import { SkillSyncsTable } from '../skillSyncs';

export let SkillMarketplaceSyncsPage = () => {
  let { skillMarketplaceId } = useParams();

  return (
    <SkillSyncsTable
      emptyMessage="No syncs found for this skill marketplace."
      query={skillMarketplaceId ? { skillMarketplaceId, order: 'desc' } : null}
    />
  );
};
