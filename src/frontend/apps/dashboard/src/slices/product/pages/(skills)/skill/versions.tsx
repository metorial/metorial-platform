import { SkillVersionsScene } from '@metorial/scene-skills';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillVersionsPage = () => {
  let instance = useCurrentInstance();
  let { skillId } = useParams();

  return <SkillVersionsScene instanceId={instance.data?.id} skillId={skillId} />;
};
