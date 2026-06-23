import { SkillMarketplaceEditorScene } from '@metorial/scene-skills';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillMarketplaceEditorPage = () => {
  let instance = useCurrentInstance();
  let { skillMarketplaceId } = useParams();

  return (
    <SkillMarketplaceEditorScene
      instanceId={instance.data?.id}
      skillMarketplaceId={skillMarketplaceId}
    />
  );
};
