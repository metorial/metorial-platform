import { SkillLinkProvidersScene } from '@metorial/scene-skills';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillProvidersPage = () => {
  let instance = useCurrentInstance();
  let { skillId } = useParams();

  return <SkillLinkProvidersScene instanceId={instance.data?.id} skillId={skillId} />;
};
